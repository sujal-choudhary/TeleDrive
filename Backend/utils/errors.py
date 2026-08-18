"""
API error handling and response formatting.
"""

from flask import jsonify


def success_response(data=None, message="Operation successful", status_code=200):
    """Create a standardized success response."""
    return jsonify({
        "success": True,
        "data": data if data is not None else {},
        "message": message,
    }), status_code


def error_response(message, code="INTERNAL_ERROR", status_code=500):
    """Create a standardized error response."""
    return jsonify({
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
    }), status_code


def register_error_handlers(app):
    """Register global error handlers for the Flask app."""

    @app.errorhandler(404)
    def not_found(error):
        return error_response("Resource not found", "NOT_FOUND", 404)

    @app.errorhandler(405)
    def method_not_allowed(error):
        return error_response("Method not allowed", "METHOD_NOT_ALLOWED", 405)

    @app.errorhandler(413)
    def payload_too_large(error):
        return error_response("Upload exceeds maximum allowed size", "FILE_TOO_LARGE", 413)

    @app.errorhandler(500)
    def internal_error(error):
        return error_response("Internal server error", "INTERNAL_ERROR", 500)