import { AuthService } from '@/services/authService';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

jest.mock('@prisma/client');
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    authService = new AuthService(mockPrisma);
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const hashedPassword = 'hashedPassword123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const createdUser = {
        id: 1,
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);

      // Act
      const result = await authService.registerUser(userData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword
        }
      });
      expect(result).toEqual({
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        createdAt: createdUser.createdAt
      });
    });

    it('should throw error when user already exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User'
      };

      mockPrisma.user.create.mockRejectedValue(new Error('User already exists'));

      // Act & Assert
      await expect(authService.registerUser(userData)).rejects.toThrow('User already exists');
    });

    it('should validate email format', async () => {
      // Arrange
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      };

      // Act & Assert
      await expect(authService.registerUser(userData)).rejects.toThrow('Invalid email format');
    });

    it('should validate password strength', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: '123', // Too short
        name: 'Test User'
      };

      // Act & Assert
      await expect(authService.registerUser(userData)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('loginUser', () => {
    it('should login user with valid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const foundUser = {
        id: 1,
        email: loginData.email,
        name: 'Test User',
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(foundUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const token = 'jwt-token-123';
      (jwt.sign as jest.Mock).mockReturnValue(token);

      // Act
      const result = await authService.loginUser(loginData);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginData.email }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, foundUser.password);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: foundUser.id, email: foundUser.email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      expect(result).toEqual({
        user: {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name
        },
        token
      });
    });

    it('should throw error for invalid email', async () => {
      // Arrange
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.loginUser(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const foundUser = {
        id: 1,
        email: loginData.email,
        name: 'Test User',
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(foundUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.loginUser(loginData)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', async () => {
      // Arrange
      const token = 'valid-jwt-token';
      const decodedToken = {
        userId: 1,
        email: 'test@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 86400
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const user = {
        id: decodedToken.userId,
        email: decodedToken.email,
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        process.env.JWT_SECRET || 'fallback-secret'
      );
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: decodedToken.userId }
      });
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name
      });
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      const token = 'invalid-jwt-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid token');
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const token = 'valid-jwt-token';
      const decodedToken = {
        userId: 999,
        email: 'nonexistent@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 86400
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.verifyToken(token)).rejects.toThrow('User not found');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token for valid user', async () => {
      // Arrange
      const oldToken = 'old-jwt-token';
      const decodedToken = {
        userId: 1,
        email: 'test@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 86400
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const user = {
        id: decodedToken.userId,
        email: decodedToken.email,
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const newToken = 'new-jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(newToken);

      // Act
      const result = await authService.refreshToken(oldToken);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token: newToken
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const userId = 1;
      const passwordData = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123'
      };

      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedOldPassword',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const newHashedPassword = 'hashedNewPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(newHashedPassword);

      const updatedUser = {
        ...user,
        password: newHashedPassword,
        updatedAt: new Date()
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authService.changePassword(userId, passwordData);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(
        passwordData.currentPassword,
        user.password
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(passwordData.newPassword, 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: newHashedPassword }
      });
      expect(result).toEqual(true);
    });

    it('should throw error for incorrect current password', async () => {
      // Arrange
      const userId = 1;
      const passwordData = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123'
      };

      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedOldPassword',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      // Arrange
      const userId = 1;
      const passwordData = {
        currentPassword: 'oldPassword123',
        newPassword: '123' // Too short
      };

      // Act & Assert
      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('New password must be at least 8 characters');
    });
  });
});