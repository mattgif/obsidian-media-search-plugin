import type { MediaTypeModel } from './MediaTypeModel';

export interface ApiQueryOptions { mediaType?: string, offset?: number }

export interface ApiQueryResponse {
	results: MediaTypeModel[];
	total: number;
	offset: number;
}