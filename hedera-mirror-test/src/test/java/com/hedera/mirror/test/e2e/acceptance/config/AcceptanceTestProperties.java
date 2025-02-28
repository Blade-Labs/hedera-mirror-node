package com.hedera.mirror.test.e2e.acceptance.config;

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

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.inject.Named;
import javax.validation.constraints.Max;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import com.hedera.mirror.test.e2e.acceptance.props.NodeProperties;

@Named
@ConfigurationProperties(prefix = "hedera.mirror.test.acceptance")
@Data
@Validated
public class AcceptanceTestProperties {

    private final FeatureProperties featureProperties;
    private final RestPollingProperties restPollingProperties;
    private final SdkProperties sdkProperties;
    private final WebClientProperties webClientProperties;

    @NotNull
    private Duration backOffPeriod = Duration.ofMillis(5000);

    private boolean createOperatorAccount = true;

    private boolean emitBackgroundMessages = false;

    @Max(5)
    private int maxRetries = 2;

    @NotNull
    private Long maxTinyBarTransactionFee = 2_000_000_000L;

    @NotNull
    private Duration messageTimeout = Duration.ofSeconds(20);

    @NotBlank
    private String mirrorNodeAddress;

    @NotNull
    private HederaNetwork network = HederaNetwork.TESTNET;

    private Set<NodeProperties> nodes = new LinkedHashSet<>();

    private long operatorBalance = 18_000_000_000L;

    @NotBlank
    private String operatorId = "0.0.2";

    @NotBlank
    private String operatorKey =
            "302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137";

    private boolean retrieveAddressBook = true;

    public enum HederaNetwork {
        MAINNET,
        OTHER,
        PREVIEWNET,
        TESTNET,
    }
}
