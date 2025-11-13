import { Test, TestingModule } from '@nestjs/testing';
import { ShopOwnerController } from './shop-owner.controller';
import { ShopOwnerService } from './shop-owner.service';

describe('ShopOwnerController', () => {
  let controller: ShopOwnerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopOwnerController],
      providers: [ShopOwnerService],
    }).compile();

    controller = module.get<ShopOwnerController>(ShopOwnerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
