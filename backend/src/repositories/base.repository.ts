import { WhereCondition, OrderByCondition, FindManyOptions } from "../types";

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
 */
export abstract class AbstractBaseRepository<T, CreateInput, UpdateInput>
  implements BaseRepository<T, CreateInput, UpdateInput>
{
  protected abstract model: {
    create: (args: { data: CreateInput }) => Promise<T>;
    createMany: (args: { data: CreateInput[] }) => Promise<{ count: number }>;
    findUnique: (args: { where: { id: string } }) => Promise<T | null>;
    findMany: (args?: FindManyOptions) => Promise<T[]>;
    findFirst: (args: { where: WhereCondition }) => Promise<T | null>;
    count: (args?: { where?: WhereCondition }) => Promise<number>;
    update: (args: { where: { id: string }; data: UpdateInput }) => Promise<T>;
    updateMany: (args: {
      where: WhereCondition;
      data: UpdateInput;
    }) => Promise<{ count: number }>;
    delete: (args: { where: { id: string } }) => Promise<T>;
    deleteMany: (args: { where: WhereCondition }) => Promise<{ count: number }>;
  };

  async create(data: CreateInput): Promise<T> {
    return await this.model.create({ data });
  }

  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    return await this.model.createMany({ data });
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
