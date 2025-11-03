import type MediaDbPlugin from '../main';
import type { ApiQueryOptions, ApiQueryResponse } from '../models/Api';
import type { MediaTypeModel } from '../models/MediaTypeModel';
import type { MediaType } from '../utils/MediaType';

export abstract class APIModel {
	apiName!: string;
	apiUrl!: string;
	apiDescription!: string;
	types!: MediaType[];
	plugin!: MediaDbPlugin;

	/**
	 * This function should query the api and return a list of matches. The matches should be capped at 20.
	 *
	 * @param title the title to query for
	 * @param {ApiQueryOptions} [queryOptions]
	 * @param {string} [queryOptions.mediaType] the type of media to query for
	 * @param {number} [queryOptions.page] the page of results to query for
	 */
	abstract searchByTitle(title: string, queryOptions: ApiQueryOptions): Promise<MediaTypeModel[] | ApiQueryResponse>;

	abstract getById(id: string): Promise<MediaTypeModel>;

	abstract getDisabledMediaTypes(): MediaType[];

	hasType(type: MediaType): boolean {
		const disabledMediaTypes = this.getDisabledMediaTypes();
		return this.types.includes(type) && !disabledMediaTypes.includes(type);
	}

	hasTypeOverlap(types: MediaType[]): boolean {
		return types.some(type => this.hasType(type));
	}
}
