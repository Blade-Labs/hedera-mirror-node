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

import {getResponseLimit} from './config';
import * as constants from './constants';
import EntityId from './entityId';
import * as utils from './utils';

const {tokenBalance: tokenBalanceLimit} = getResponseLimit();

const formatBalancesResult = (req, result, limit, order) => {
  const {rows, sqlQuery} = result;
  const ret = {
    timestamp: null,
    balances: [],
    links: {
      next: null,
    },
  };

  if (rows.length > 0) {
    ret.timestamp = utils.nsToSecNs(rows[0].consensus_timestamp);
  }

  ret.balances = rows.map((row) => {
    return {
      account: EntityId.parse(row.account_id).toString(),
      balance: row.balance,
      tokens: utils.parseTokenBalances(row.token_balances),
    };
  });

  const anchorAccountId = ret.balances.length > 0 ? ret.balances[ret.balances.length - 1].account : 0;

  // Pagination links
  ret.links = {
    next: utils.getPaginationLink(
      req,
      ret.balances.length !== limit,
      {
        [constants.filterKeys.ACCOUNT_ID]: anchorAccountId,
      },
      order
    ),
  };

  if (utils.isTestEnv()) {
    ret.sqlQuery = sqlQuery;
  }

  return ret;
};

const entityJoin = `join (select id, public_key from entity where type in ('ACCOUNT', 'CONTRACT')) ac on ac.id = ab.account_id`;

/**
 * Handler function for /balances API.
 * @param {Request} req HTTP request object
 * @return {Promise} Promise for PostgreSQL query
 */
const getBalances = async (req, res) => {
  utils.validateReq(req);

  // Parse the filter parameters for credit/debit, account-numbers, timestamp and pagination
  const [accountQuery, accountParams] = utils.parseAccountIdQueryParam(req.query, 'ab.account_id');
  // transform the timestamp=xxxx or timestamp=eq:xxxx query in url to 'timestamp <= xxxx' SQL query condition
  const [tsQuery, tsParams] = utils.parseTimestampQueryParam(req.query, 'consensus_timestamp', {
    [utils.opsMap.eq]: utils.opsMap.lte,
  });
  const [balanceQuery, balanceParams] = utils.parseBalanceQueryParam(req.query, 'ab.balance');
  const [pubKeyQuery, pubKeyParams] = utils.parsePublicKeyQueryParam(req.query, 'ac.public_key');
  const {query, params, order, limit} = utils.parseLimitAndOrderParams(req, constants.orderFilterValues.DESC);

  // Use the inner query to find the latest snapshot timestamp from the balance history table
  const innerQuery = `
    select consensus_timestamp
    from account_balance_file ${(tsQuery && `where ${tsQuery}`) || ''}
    order by consensus_timestamp desc
    limit 1`;

  const whereClause = `
      where ${[`ab.consensus_timestamp = (${innerQuery})`, accountQuery, pubKeyQuery, balanceQuery]
        .filter((q) => q !== '')
        .join(' and ')}`;

  // Only need to join entity if we're selecting on publickey.
  const joinEntityClause = pubKeyQuery !== '' ? entityJoin : '';

  // token balances pairs are aggregated as an array of json objects {token_id, balance}
  const sqlQuery = `
    select ab.*,
           (select json_agg(json_build_object('token_id', token_id, 'balance', balance))
            from (select token_id, balance
                  from token_balance tb
                  where tb.account_id = ab.account_id
                    and tb.consensus_timestamp = ab.consensus_timestamp
                  order by token_id ${order}
                  limit ${tokenBalanceLimit.multipleAccounts}) as account_token_balance) as token_balances
    from account_balance ab
      ${joinEntityClause} ${whereClause}
    order by ab.account_id ${order} ${query}`;

  const sqlParams = utils.mergeParams(tsParams, accountParams, pubKeyParams, balanceParams, params);
  const pgSqlQuery = utils.convertMySqlStyleQueryToPostgres(sqlQuery);

  if (logger.isTraceEnabled()) {
    logger.trace(`getBalance query: ${pgSqlQuery} ${utils.JSONStringify(sqlParams)}`);
  }

  // Execute query
  const result = await pool.queryQuietly(pgSqlQuery, sqlParams);
  res.locals[constants.responseDataLabel] = formatBalancesResult(req, result, limit, order);
  logger.debug(`getBalances returning ${result.rows.length} entries`);
};

export default {
  getBalances,
};
