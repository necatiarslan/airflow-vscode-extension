/**
 * Custom error class for Airflow API exceptions
 * Provides detailed error information including HTTP status codes and response details
 */
export class AirflowApiException extends Error {
    public readonly statusCode: number;
    public readonly statusText: string;
    public readonly responseBody: any;
    public readonly requestUrl: string;
    public readonly requestMethod: string;

    constructor(
        message: string,
        statusCode: number,
        statusText: string,
        requestMethod: string,
        requestUrl: string,
        responseBody?: any
    ) {
        super(message);
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AirflowApiException);
        }

        this.name = 'AirflowApiException';
        this.statusCode = statusCode;
        this.statusText = statusText;
        this.requestMethod = requestMethod;
        this.requestUrl = requestUrl;
        this.responseBody = responseBody;

        // Set the prototype explicitly to support instanceof checks
        Object.setPrototypeOf(this, AirflowApiException.prototype);
    }

    /**
     * Get a user-friendly error message based on the HTTP status code
     */
    public getUserFriendlyMessage(): string {
        switch (this.statusCode) {
            case 401:
                return 'Authentication failed. Please check your credentials or JWT token.';
            case 403:
                return 'Access forbidden. You do not have permission to perform this action.';
            case 404:
                return 'Resource not found. The requested DAG, task, or other resource does not exist.';
            case 409:
                return 'Conflict. The resource already exists or is in an invalid state for this operation.';
            case 422:
                return 'Validation error. The request contains invalid data.';
            case 429:
                return 'Rate limit exceeded. Please try again later.';
            case 500:
                return 'Internal server error. Please check the Airflow server logs.';
            case 503:
                return 'Service unavailable. The Airflow server may be down or overloaded.';
            default:
                return this.message;
        }
    }

    /**
     * Convert the error to a detailed JSON object
     */
    public toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            userFriendlyMessage: this.getUserFriendlyMessage(),
            statusCode: this.statusCode,
            statusText: this.statusText,
            requestMethod: this.requestMethod,
            requestUrl: this.requestUrl,
            responseBody: this.responseBody,
            stack: this.stack
        };
    }

    /**
     * Create an AirflowApiException from a fetch Response object
     */
    public static async fromResponse(
        response: Response,
        requestMethod: string,
        requestUrl: string
    ): Promise<AirflowApiException> {
        let responseBody: any;
        let message: string;

        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                responseBody = await response.json();
                message = responseBody.detail || responseBody.title || responseBody.message || response.statusText;
            } else {
                responseBody = await response.text();
                message = response.statusText;
            }
        } catch (parseError) {
            responseBody = null;
            message = response.statusText;
        }

        return new AirflowApiException(
            message,
            response.status,
            response.statusText,
            requestMethod,
            requestUrl,
            responseBody
        );
    }
}

/**
 * Error thrown when the update_mask parameter is missing for a PATCH operation
 */
export class MissingUpdateMaskError extends Error {
    constructor(resource: string) {
        super(
            `update_mask is required for atomic updates to ${resource}. ` +
            `This ensures data integrity by specifying exactly which fields should be modified.`
        );
        this.name = 'MissingUpdateMaskError';
        Object.setPrototypeOf(this, MissingUpdateMaskError.prototype);
    }
}

/**
 * Error thrown when required parameters are missing
 */
export class ValidationError extends Error {
    public readonly parameterName: string;

    constructor(parameterName: string, message?: string) {
        super(message || `Required parameter '${parameterName}' is missing or invalid.`);
        this.name = 'ValidationError';
        this.parameterName = parameterName;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
