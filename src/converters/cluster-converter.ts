import { BaseConverter } from './base-converter.js';
import { HiveMQConfig, EMQXConfig, ClusterEMQXConfig } from '../types.js';

export class ClusterConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    if (!config.hivemq?.cluster) {
      return {};
    }

    const cluster = config.hivemq.cluster;
    if (this.getTextContent(cluster, 'enabled') === 'false') return {};
    const clusterConfig: ClusterEMQXConfig = {
      discovery_strategy: 'static',
      static: { seeds: [] },
    };

    if (!cluster.discovery?.static) {
      this.warn(
        'Only static cluster discovery can be converted. Configure EMQX cluster discovery manually.'
      );
      return {};
    }

    const staticConfig = cluster.discovery.static;
    const staticEnabled = this.getTextContent(staticConfig, 'enabled');

    if (staticEnabled === 'false') {
      return {};
    }
    const nodes: string[] = [];

    // Handle seeds array
    if (staticConfig.seeds?.seed) {
      const seedArray = Array.isArray(staticConfig.seeds.seed)
        ? staticConfig.seeds.seed
        : [staticConfig.seeds.seed];
      for (const seed of seedArray) {
        const seedValue = this.getTextContent(seed, '') || seed;
        if (seedValue) {
          nodes.push(seedValue);
        }
      }
    }

    // Handle individual nodes (fallback)
    if (staticConfig.node) {
      const nodeArray = Array.isArray(staticConfig.node)
        ? staticConfig.node
        : [staticConfig.node];
      for (const node of nodeArray) {
        const host = this.getTextContent(node, 'host');
        if (host) {
          nodes.push(`emqx@${host}`);
        }
      }
    }

    if (nodes.length === 0) {
      return {};
    }

    clusterConfig.static.seeds = [...new Set(nodes)];
    this.warn(
      'Static cluster seeds use emqx@host node names. Review node names, the shared cookie and distribution ports before deploying.'
    );

    // Warn about TCP transport settings
    if (cluster.transport?.tcp) {
      this.warn(
        'TCP transport settings for clustering are not directly convertible. EMQX uses Erlang distribution for node communication. Please review your EMQX node and networking setup.'
      );
    }

    return { cluster: clusterConfig };
  }
}
