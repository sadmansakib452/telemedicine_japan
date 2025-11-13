import { Test, TestingModule } from '@nestjs/testing';
import { ShopOwnerService } from './shop-owner.service';

describe('ShopOwnerService', () => {
  let service: ShopOwnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShopOwnerService],
    }).compile();

    service = module.get<ShopOwnerService>(ShopOwnerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
