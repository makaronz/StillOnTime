import { WhereCondition, OrderByCondition, FindManyOptions } from "../types";
import type { Prisma } from "@prisma/client";

// Re-export types for use by other repositories
export { FindManyOptions, WhereCondition, OrderByCondition };

/**
 * Base Repository Interface
 * Defines common CRUD operations for all repositories
 */
export interface BaseRepository<T, CreateInput, UpdateInput> {
  // Create operations
  create(data: CreateInput): Promise<T>;
  createMany(data: CreateInput[]): Promise<{ count: number }>;

  // Read operations
  findById(id: string): Promise<T | null>;
  findMany(options?: FindManyOptions): Promise<T[]>;
  findFirst(where: WhereCondition): Promise<T | null>;
  count(where?: WhereCondition): Promise<number>;

  // Update operations
  update(id: string, data: UpdateInput): Promise<T>;
  updateMany(
    where: WhereCondition,
    data: UpdateInput
  ): Promise<{ count: number }>;

  // Delete operations
  delete(id: string): Promise<T>;
  deleteMany(where: WhereCondition): Promise<{ count: number }>;

  // Utility operations
  exists(where: WhereCondition): Promise<boolean>;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Abstract Base Repository Implementation
 * Provides common functionality for all repositories
 * Uses a simpler approach that works with Prisma 5.22.0
 */
export abstract class AbstractBaseRepository<T, CreateInput, UpdateInput>
  implements BaseRepository<T, CreateInput, UpdateInput>
{
  protected abstract model: any; // Use any to avoid complex typing issues

  async create(data: CreateInput): Promise<T> {
    return await this.model.create({ data });
  }

  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    // Handle the difference between CreateInput and CreateManyInput
    const createManyData = data.map((item: any) => {
      // Extract scalar fields for createMany
      const { user, schedule, ...scalarFields } = item;

      // Add userId and scheduleId if they exist in relations
      if (user?.connect?.id) {
        scalarFields.userId = user.connect.id;
      }
      if (schedule?.connect?.id) {
        scalarFields.scheduleId = schedule.connect.id;
      }

      return scalarFields;
    });

    return await this.model.createMany({
      data: createManyData,
      skipDuplicates: false,
    });
  }

  async findById(id: string): Promise<T | null> {
    return await this.model.findUnique({ where: { id } });
  }

  async findMany(options: FindManyOptions = {}): Promise<T[]> {
    return await this.model.findMany(options);
  }

  async findFirst(where: WhereCondition): Promise<T | null> {
    return await this.model.findFirst({ where });
  }

  async count(where?: WhereCondition): Promise<number> {
    return await this.model.count({ where });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return await this.model.update({
      where: { id },
      data,
    });
  }

  async updateMany(
    where: WhereCondition,
    data: UpdateInput
  ): Promise<{ count: number }> {
    return await this.model.updateMany({ where, data });
  }

  async delete(id: string): Promise<T> {
    return await this.model.delete({ where: { id } });
  }

  async deleteMany(where: WhereCondition): Promise<{ count: number }> {
    return await this.model.deleteMany({ where });
  }

  async exists(where: WhereCondition): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Paginated find with metadata
   */
  async findManyPaginated(
    options: FindManyOptions & PaginationOptions
  ): Promise<PaginatedResult<T>> {
    const { page, limit, ...findOptions } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.findMany({
        ...findOptions,
        skip,
        take: limit,
      }),
      this.model.count({ where: findOptions.where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
