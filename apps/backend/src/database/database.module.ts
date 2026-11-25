import { Module, Global } from '@nestjs/common';
import { KnexModule } from 'nestjs-knex';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    KnexModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        config: {
          client: 'pg',
          connection: {
            host: configService.get('DB_HOST', 'localhost'),
            port: configService.get('DB_PORT', 5432),
            user: configService.get('DB_USER', 'postgres'),
            password: configService.get('DB_PASSWORD', 'postgres'),
            database: configService.get('DB_NAME', 'resq_live'),
          },
          pool: {
            min: 2,
            max: 10,
          },
          migrations: {
            tableName: 'knex_migrations',
            directory: './src/database/migrations',
          },
          postProcessResponse: (result) => {
            // Convert PostGIS geometry to GeoJSON if needed
            return result;
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [KnexModule],
})
export class DatabaseModule {}