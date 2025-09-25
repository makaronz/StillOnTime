import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateSecureState,
  validateState,
  validateAuthCode,
  cleanupOAuthStorage,
} from "@/utils/oauth";

describe("OAuth Utilities", () => {
  beforeEach(() => {
    // Clear session storage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    sessionStorage.clear();
  });

  describe("generateSecureState", () => {
    it("should generate a secure state string", () => {
      const state = generateSecureState();

      expect(state).toBeDefined();
      expect(typeof state).toBe("string");
      expect(state.length).toBe(64); // 32 bytes * 2 hex chars
      expect(state).toMatch(/^[a-f0-9]+$/); // Only hex characters
    });

    it("should generate different states on each call", () => {
      const state1 = generateSecureState();
      const state2 = generateSecureState();

      expect(state1).not.toBe(state2);
    });
  });

  describe("validateState", () => {
    it("should return true for matching states", () => {
      const state = "test-state-123";
      const result = validateState(state, state);

      expect(result).toBe(true);
    });

    it("should return false for non-matching states", () => {
      const state1 = "test-state-123";
      const state2 = "test-state-456";
      const result = validateState(state1, state2);

      expect(result).toBe(false);
    });

    it("should return false for null stored state", () => {
      const state = "test-state-123";
      const result = validateState(state, null);

      expect(result).toBe(false);
    });

    it("should return false for empty received state", () => {
      const storedState = "test-state-123";
      const result = validateState("", storedState);

      expect(result).toBe(false);
    });

    it("should return false for different length states", () => {
      const state1 = "short";
      const state2 = "much-longer-state";
      const result = validateState(state1, state2);

      expect(result).toBe(false);
    });
  });

  describe("validateAuthCode", () => {
    it("should return true for valid auth codes", () => {
      const validCodes = [
        "abcdefghij1234567890",
        "valid-auth-code-123",
        "VALID_AUTH_CODE_456",
        "valid.auth.code.789",
        "valid~auth~code~000",
      ];

      validCodes.forEach((code) => {
        expect(validateAuthCode(code)).toBe(true);
      });
    });

    it("should return false for invalid auth codes", () => {
      const invalidCodes = [
        "", // empty
        "short", // too short
        null as any, // null
        undefined as any, // undefined
        123 as any, // number
        "invalid code with spaces", // spaces
        "invalid@code#with$symbols", // invalid symbols
        "a".repeat(600), // too long
      ];

      invalidCodes.forEach((code) => {
        expect(validateAuthCode(code)).toBe(false);
      });
    });
  });

  describe("cleanupOAuthStorage", () => {
    it("should remove OAuth-related items from session storage", () => {
      // Set up some OAuth data
      sessionStorage.setItem("oauth_state", "test-state");
      sessionStorage.setItem("oauth_nonce", "test-nonce");
      sessionStorage.setItem("other_data", "should-remain");

      // Clean up
      cleanupOAuthStorage();

      // Check results
      expect(sessionStorage.getItem("oauth_state")).toBeNull();
      expect(sessionStorage.getItem("oauth_nonce")).toBeNull();
      expect(sessionStorage.getItem("other_data")).toBe("should-remain");
    });

    it("should not throw error if items do not exist", () => {
      expect(() => cleanupOAuthStorage()).not.toThrow();
    });
  });
});
