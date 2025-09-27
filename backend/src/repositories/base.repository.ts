import { WhereCondition, OrderByCondition, FindManyOptions } from "../types";
import type { Prisma } from "@prisma/client";

// Re-export types for use by other repositories
export { FindManyOptions, WhereCondition, OrderByCondition };

/**
 * Base Repository Interface
 * Defines common CRUD operations for all repositories using Prisma Args types
 */
export interface BaseRepository<TDelegate> {
  // Create operations
  create<TArgs>(args: TArgs): Promise<any>;
  createMany<TArgs>(args: TArgs): Promise<Prisma.BatchPayload>;

  // Read operations
  findById(id: string): Promise<any>;
  findMany<TArgs>(args?: TArgs): Promise<any[]>;
  findFirst<TArgs>(args: TArgs): Promise<any>;
  count<TArgs>(args?: TArgs): Promise<number>;

  // Update operations
  update<TArgs>(args: TArgs): Promise<any>;
  updateMany<TArgs>(args: TArgs): Promise<Prisma.BatchPayload>;

  // Delete operations
  delete<TArgs>(args: TArgs): Promise<any>;
  deleteMany<TArgs>(args: TArgs): Promise<Prisma.BatchPayload>;

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
 * Provides common functionality for all repositories using Prisma delegates
 */
export abstract class AbstractBaseRepository<
  TDelegate extends {
    create: (args: any) => Promise<any>;
    createMany: (args: any) => Promise<Prisma.BatchPayload>;
    update: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
    delete: (args: any) => Promise<any>;
    deleteMany: (args: any) => Promise<Prisma.BatchPayload>;
  }
> implements BaseRepository<TDelegate>
{
  protected abstract model: TDelegate;

  create<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.create(args);
  }

  createMany<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.createMany(args);
  }

  findById(id: string) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.findUnique({ where: { id } });
  }

  findMany<TArgs>(args?: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.findMany(args);
  }

  findFirst<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.findFirst(args);
  }

  count<TArgs>(args?: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.count(args);
  }

  update<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.update(args);
  }

  updateMany<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.updateMany(args);
  }

  delete<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.delete(args);
  }

  deleteMany<TArgs>(args: TArgs) {
    // @ts-expect-error - Let delegate drive the type
    return this.model.deleteMany(args);
  }

  async exists(where: WhereCondition): Promise<boolean> {
    // @ts-expect-error - Let delegate drive the type
    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Paginated find with metadata
   */
  async findManyPaginated(
    options: FindManyOptions & PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { page, limit, ...findOptions } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      // @ts-expect-error - Let delegate drive the type
      this.model.findMany({
        ...findOptions,
        skip,
        take: limit,
      }),
      // @ts-expect-error - Let delegate drive the type
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
