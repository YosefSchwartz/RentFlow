import { Module } from '@nestjs/common';
import { PropertyMediaController } from './property-media.controller';
import { PropertyMediaService } from './property-media.service';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [PropertiesModule],
  controllers: [PropertyMediaController],
  providers: [PropertyMediaService],
  exports: [PropertyMediaService],
})
export class PropertyMediaModule {}
