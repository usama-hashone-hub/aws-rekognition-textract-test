// Required dependencies
const express = require("express");
const { RekognitionClient, DetectFacesCommand, CompareFacesCommand } = require("@aws-sdk/client-rekognition");
const { TextractClient, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract");
const multer = require("multer");
const sharp = require("sharp");
const joi = require("joi");
const winston = require("winston");
require('dotenv').config();

// Initialize AWS services with credentials
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
};


const rekognitionClient = new RekognitionClient(awsConfig);
const textractClient = new TextractClient(awsConfig);

// Configure logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Validation schemas
const verificationSchema = joi.object({
  userId: joi.string().required(),
}).unknown(true);  // Allow unknown keys for file uploads

// Custom middleware to validate files
const validateFiles = (req, res, next) => {
  if (!req.files || !req.files.idCard || !req.files.selfie) {
    return res.status(400).json({ error: 'Both idCard and selfie files are required' });
  }
  
  const idCard = req.files.idCard[0];
  const selfie = req.files.selfie[0];
  
  // Validate file types (only allow images)
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!allowedMimeTypes.includes(idCard.mimetype) || !allowedMimeTypes.includes(selfie.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only JPEG and PNG images are allowed' });
  }
  
  // Validate file size (e.g., max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (idCard.size > maxSize || selfie.size > maxSize) {
    return res.status(400).json({ error: 'File size too large. Maximum size is 5MB' });
  }
  
  next();
};

// Image processing middleware
async function preprocessImage(buffer) {
  try {
    return await sharp(buffer)
      .resize(1200, 1200, { fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (error) {
    logger.error("Image preprocessing failed:", error);
    throw new Error("Image preprocessing failed");
  }
}

// Face detection and analysis
async function detectFaces(imageBuffer) {
  try {
    const params = {
      Image: {
        Bytes: imageBuffer,
      },
      Attributes: ["ALL"],
    };

    const command = new DetectFacesCommand(params);
    const response = await rekognitionClient.send(command);
    return response.FaceDetails;
  } catch (error) {
    logger.error("Face detection failed:", error);
    throw new Error("Face detection failed");
  }
}

// Compare faces between ID and selfie
async function compareFaces(sourceImageBuffer, targetImageBuffer) {
  try {
    const params = {
      SourceImage: {
        Bytes: sourceImageBuffer,
      },
      TargetImage: {
        Bytes: targetImageBuffer,
      },
      SimilarityThreshold: 90.0,
    };

    const command = new CompareFacesCommand(params);
    const response = await rekognitionClient.send(command);
    return {
      matches: response.FaceMatches,
      similarity: response.FaceMatches[0]?.Similarity || 0,
    };
  } catch (error) {
    logger.error("Face comparison failed:", error);
    throw new Error("Face comparison failed");
  }
}

// Verify ID card authenticity
async function verifyIdCard(imageBuffer) {
  try {
    // Extract text from ID card
    const textractParams = {
      Document: {
        Bytes: imageBuffer,
      },
      FeatureTypes: ["FORMS", "TABLES"],
    };

    const command = new AnalyzeDocumentCommand(textractParams);
    const textractResponse = await textractClient.send(command);

    // Implement ID card validation logic
    const validationResults = validateIdCardElements(textractResponse.Blocks);

    return validationResults;
  } catch (error) {
    logger.error("ID card verification failed:", error);
    throw new Error("ID card verification failed");
  }
}

// ID card validation helper
function validateIdCardElements(blocks) {
  // Example validation rules - customize based on your requirements
  const idCardElements = {
    hasPhoto: false,
    hasName: false,
    hasValidDate: false,
    hasSecurityFeatures: false,
  };

  // Implement specific validation logic
  // This is a simplified example - add more sophisticated checks based on your needs
  blocks.forEach((block) => {
    // Check for photo region
    if (block.BlockType === "CELL" && block.Confidence > 90) {
      idCardElements.hasPhoto = true;
    }
    // Add more validation rules
  });

  return idCardElements;
}

// Main verification handler
async function handleVerification(idCardBuffer, selfieBuffer, userId) {
  try {
    // 1. Preprocess images
    const processedIdCard = await preprocessImage(idCardBuffer);
    const processedSelfie = await preprocessImage(selfieBuffer);

    // 2. Verify ID card authenticity
    const idCardValidation = await verifyIdCard(processedIdCard);
    if (!idCardValidation.hasPhoto || !idCardValidation.hasValidDate) {
      throw new Error("Invalid ID card");
    }

    // 3. Detect faces in both images
    const idCardFaces = await detectFaces(processedIdCard);
    const selfieFaces = await detectFaces(processedSelfie);

    // Validate face detection results
    if (!idCardFaces.length || !selfieFaces.length) {
      throw new Error("No face detected in one or both images");
    }

    // 4. Compare faces
    const comparisonResult = await compareFaces(
      processedIdCard,
      processedSelfie
    );

    // 5. Prepare verification result
    return {
      success: comparisonResult.similarity >= 90,
      similarity: comparisonResult.similarity,
      idCardValid: true,
      verificationId: userId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Verification failed:", error);
    throw error;
  }
}

// Express route handler
const router = express.Router();
const upload = multer();

router.post(
  "/verify",
  upload.fields([
    { name: "idCard", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  validateFiles,
  async (req, res) => {
    try {
      // Validate request body
      const { error } = verificationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await handleVerification(
        req.files.idCard[0].buffer,
        req.files.selfie[0].buffer,
        req.body.userId
      );

      res.json(result);
    } catch (error) {
      logger.error("Route handler error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
