import { ConfigModule, ConfigService } from '@nestjs/config';
import { Knex } from 'knex';

ConfigModule.forRoot({
  envFilePath: ['.env.local', '.env'],
});

const configService = new ConfigService();

const knexConfig: Knex.Config = {
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
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
  },
};

export default knexConfig;