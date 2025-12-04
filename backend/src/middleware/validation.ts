import { Response, NextFunction } from "express";
import { AppRequest } from "@/types/requests";
import { z } from "zod";

export interface ValidationSchema {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}

export function validateRequest(schema: ValidationSchema) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Internal validation error",
        });
      }
    }
  };
}