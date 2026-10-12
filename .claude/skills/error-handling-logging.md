# Error Handling & Logging

## HTTP
- 400 validation, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 429 rate limit, 500 server.

## Shape
{ code: "STUDENT_NOT_FOUND", message: "...", details?: {...} }

## Server
- Wrap handlers in asyncHandler.
- Central error middleware maps AppError → response.
- Log: { level, msg, reqId, userId, route, durationMs }.

## Client
- TanStack Query onError → toast. Never console.log in prod.
