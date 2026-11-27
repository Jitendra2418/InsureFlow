package com.insureflow.api.support;

/** Ends a request with this status and JSON body (like `return res.status(s).json(body)`). */
public class ApiError extends RuntimeException {
    public final int status;
    public final Object body;

    public ApiError(int status, Object body) {
        super(String.valueOf(body), null, false, false);
        this.status = status;
        this.body = body;
    }
}
