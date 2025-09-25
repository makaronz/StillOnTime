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
  findFirst(where: any): Promise<T | null>;
  count(where?: any): Promise<number>;

  // Update operations
  update(id: string, data: UpdateInput): Promise<T>;
  updateMany(where: any, data: UpdateInput): Promise<{ count: number }>;

  // Delete operations
  delete(id: string): Promise<T>;
  deleteMany(where: any): Promise<{ count: number }>;

  // Utility operations
  exists(where: any): Promise<boolean>;
}

export interface FindManyOptions {
  where?: any;
  orderBy?: any;
  skip?: number;
  take?: number;
  include?: any;
  select?: any;
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
  protected abstract model: any;

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

  async findFirst(where: any): Promise<T | null> {
    return await this.model.findFirst({ where });
  }

  async count(where?: any): Promise<number> {
    return await this.model.count({ where });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return await this.model.update({
      where: { id },
      data,
    });
  }

  async updateMany(where: any, data: UpdateInput): Promise<{ count: number }> {
    return await this.model.updateMany({ where, data });
  }

  async delete(id: string): Promise<T> {
    return await this.model.delete({ where: { id } });
  }

  async deleteMany(where: any): Promise<{ count: number }> {
    return await this.model.deleteMany({ where });
  }

  async exists(where: any): Promise<boolean> {
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
