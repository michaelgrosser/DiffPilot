import { FileSystemService } from './fileSystemService';
import { GitService } from './gitService';
import { ReviewService } from './reviewService';
import { FileContentService } from './fileContentService';
import { ReviewRepository } from '../repositories/reviewRepository';
import { IReviewRepository } from '../repositories/interfaces';

export interface ServiceContainer {
  fileSystemService: FileSystemService;
  gitService: GitService;
  reviewService: ReviewService;
  fileContentService: FileContentService;
  reviewRepository: IReviewRepository;
}

export class DIContainer {
  private static instance: DIContainer;
  private services: Partial<ServiceContainer> = {};
  
  private constructor() {}

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  public register<K extends keyof ServiceContainer>(key: K, service: ServiceContainer[K]): void {
    this.services[key] = service;
  }

  public get<K extends keyof ServiceContainer>(key: K): ServiceContainer[K] {
    const service = this.services[key];
    if (!service) {
      throw new Error(`Service ${key} not registered in container`);
    }
    return service;
  }

  public initialize(): void {
    // Initialize core services
    const fileSystemService = FileSystemService.getInstance();
    const gitService = GitService.getInstance();
    const fileContentService = FileContentService.getInstance();
    
    // Initialize repository
    const reviewsDirectory = fileSystemService.getReviewsDirectory();
    const reviewRepository = new ReviewRepository(fileSystemService, reviewsDirectory);
    
    // Register services
    this.register('fileSystemService', fileSystemService);
    this.register('gitService', gitService);
    this.register('fileContentService', fileContentService);
    this.register('reviewRepository', reviewRepository);
    
    // ReviewService needs special handling as it depends on other services
    const reviewService = ReviewService.getInstance();
    this.register('reviewService', reviewService);
  }

  public reset(): void {
    this.services = {};
  }
}