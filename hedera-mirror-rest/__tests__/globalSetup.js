/*-
 * ‌
 * Hedera Mirror Node
 * ​
 * Copyright (C) 2019 - 2022 Hedera Hashgraph, LLC
 * ​
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ‍
 */

import crypto from 'crypto';
import pg from 'pg';
import {GenericContainer} from 'testcontainers';

const DEFAULT_DB_NAME = 'mirror_node_integration';
const POSTGRES_PORT = 5432;

const v1DatabaseImage = 'postgres:14-alpine';
const v2DatabaseImage = 'citusdata/citus:10.2.2-alpine';

const isV2Schema = () => process.env.MIRROR_NODE_SCHEMA === 'v2';

const createDbContainer = async (maxWorkers) => {
  const dbAdminUser = 'mirror_api_admin';
  const dbAdminPassword = crypto.randomBytes(16).toString('hex');
  const image = isV2Schema() ? v2DatabaseImage : v1DatabaseImage;
  console.info(`Starting PostgreSQL docker container with image ${image}`);

  const dockerDb = await new GenericContainer(image)
    .withEnv('POSTGRES_USER', dbAdminUser)
    .withEnv('POSTGRES_PASSWORD', dbAdminPassword)
    .withExposedPorts(POSTGRES_PORT)
    .start();
  const host = dockerDb.getHost();
  const port = dockerDb.getMappedPort(POSTGRES_PORT);
  console.info(`Started dockerized PostgreSQL at ${host}:${port}`);

  process.env.INTEGRATION_DATABASE_URL = `postgresql://${dbAdminUser}:${dbAdminPassword}@${host}:${port}`;

  const poolConfig = {
    user: dbAdminUser,
    host,
    database: 'postgres',
    password: dbAdminPassword,
    port,
    sslmode: 'DISABLE',
  };
  const pool = new pg.Pool(poolConfig);

  for (let i = 1; i <= maxWorkers; i++) {
    // JEST_WORKER_ID starts from 1
    const dbName = getDatabaseNameForWorker(i);
    await pool.query(`create database ${dbName} with owner ${dbAdminUser}`);

    if (isV2Schema()) {
      // create citus extension
      const workerPool = new pg.Pool({...poolConfig, database: dbName});
      await workerPool.query('create extension if not exists citus');
      await workerPool.end();
    }
  }

  await pool.end();
  console.info(`Created separate databases for each of ${maxWorkers} jest workers`);
};

const getDatabaseName = () => getDatabaseNameForWorker(process.env.JEST_WORKER_ID);

const getDatabaseNameForWorker = (workerId) => `${DEFAULT_DB_NAME}_${workerId}`;

export default async function (globalConfig) {
  await createDbContainer(globalConfig.maxWorkers);
}

export {getDatabaseName};
