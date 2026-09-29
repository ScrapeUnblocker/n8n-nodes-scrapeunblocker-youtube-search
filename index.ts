import { YouTubeSearchScraper } from './nodes/YouTubeSearchScraper/YouTubeSearchScraper.node';
import { ApifyApi } from './credentials/ApifyApi.credentials';

export const nodeTypes = [YouTubeSearchScraper];

export const credentialTypes = [ApifyApi];
