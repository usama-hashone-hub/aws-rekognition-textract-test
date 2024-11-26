# AWS Rekognition & Textract ID Verification API

This project provides an API for ID verification using AWS Rekognition and Textract services. It can verify ID cards and match them with selfie photos for identity verification.

## Features

- ID Card Text Extraction (AWS Textract)
- Face Detection in ID Cards and Selfies
- Face Comparison between ID and Selfie
- Image Preprocessing and Optimization
- Comprehensive Error Handling and Logging
- File Type and Size Validation
- Secure Credential Management

## Prerequisites

- Node.js (v14 or higher)
- AWS Account with access to Rekognition and Textract services
- AWS credentials (Access Key ID and Secret Access Key)

## Installation

1. Clone the repository

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your AWS credentials:
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```

## Configuration

The application uses environment variables for configuration. Make sure to:
1. Create a `.env` file based on the template above
2. Replace the placeholder values with your actual AWS credentials
3. Add `.env` to your `.gitignore` file to prevent committing sensitive data

## API Endpoints

### Health Check
- `GET /health`
  - Returns server status

### ID Verification
- `POST /api/verify`
  - **Body** (multipart/form-data):
    - `idCard`: ID card image file (JPEG/PNG, max 5MB)
    - `selfie`: Selfie image file (JPEG/PNG, max 5MB)
    - `userId`: Unique identifier for the verification
  - **Response**: 
    ```json
    {
      "success": boolean,
      "similarity": number,
      "idCardValid": boolean,
      "verificationId": string,
      "timestamp": string
    }
    ```

### Document Data Extraction
- `POST /api/extract-document`
  - Extracts text, form fields, and tables from documents using AWS Textract
  - **Body** (multipart/form-data):
    - `document`: Document image file (JPEG/PNG, max 10MB)
  - **Response**: 
    ```json
    {
      "success": true,
      "data": {
        "formFields": {
          "field1": "value1",
          "field2": "value2"
        },
        "tables": [
          {
            "rowCount": number,
            "columnCount": number,
            "rows": [["cell1", "cell2"], ["cell3", "cell4"]]
          }
        ],
        "rawBlocks": [] // Original Textract blocks
      }
    }
    ```

## File Validation

The API implements strict file validation:
- ID Verification:
  - Supported formats: JPEG, PNG
  - Maximum file size: 5MB per image
  - Required fields: Both idCard and selfie images
- Document Extraction:
  - Supported formats: JPEG, PNG
  - Maximum file size: 10MB per document

## Development

Start the development server with auto-reload:
```bash
npm run dev
```
The server will run on port 3000 by default (configurable via PORT environment variable).

## Error Handling

The API includes comprehensive error handling for:
- Invalid input validation
- Image processing errors
- AWS service errors
- Server errors
- File type/size validation errors

## Logging

Logging is implemented using Winston with:
- Error logs: `error.log`
- Combined logs: `combined.log`
- Development HTTP logs via Morgan

## Dependencies

- Express.js - Web framework
- AWS SDK v3 - AWS services integration
- Multer - File upload handling
- Sharp - Image processing
- Joi - Request validation
- Winston - Logging
- Morgan - HTTP request logging
- CORS - Cross-origin resource sharing
- dotenv - Environment variable management

## Security Notes

- Environment variables for credential management
- Input validation for all requests
- File type and size restrictions
- Secure image processing
- Proper error handling without exposing sensitive information
- CORS enabled for cross-origin requests

## License

ISC