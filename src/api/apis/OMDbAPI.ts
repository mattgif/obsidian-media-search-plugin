import { requestUrl } from 'obsidian';
import type MediaDbPlugin from '../../main';
import { GameModel } from '../../models/GameModel';
import type { MediaTypeModel } from '../../models/MediaTypeModel';
import { MovieModel } from '../../models/MovieModel';
import { SeriesModel } from '../../models/SeriesModel';
import { MediaType } from '../../utils/MediaType';
import type {ApiQueryOptions} from '../APIModel';
import { APIModel  } from '../APIModel';

interface ErrorResponse {
	Response: 'False';
	Error: string;
}

interface SearchResult {
	Title: string;
	Year: string;
	Poster: string;
	imdbID: string;
	Type: string;
}

type SearchResponse =
	| {
			Response: 'True';
			totalResults: string;
			Search: SearchResult[];
	  }
	| ErrorResponse;

type IdResponse =
	| {
			Response: 'True';
			Title: string;
			Year: string;
			Rated: string;
			Released: string;
			Runtime: string;
			Genre: string;
			Director: string;
			Writer: string;
			Actors: string;
			Plot: string;
			Language: string;
			Country: string;
			Awards: string;
			Poster: string;
			Metascore: string;
			imdbRating: string;
			imdbVotes: string;
			imdbID: string;
			Type: string;
			DVD: string;
			BoxOffice: string;
			Production: string;
			Website: string;
	  }
	| ErrorResponse;

interface SearchOptions { title: string, mediaType?: string, page?: number }

export class OMDbAPI extends APIModel {
	plugin: MediaDbPlugin;
	typeMappings: Map<string, string>;
	apiDateFormat: string = 'DD MMM YYYY';
	baseUrl = 'https://www.omdbapi.com'
	pageSize = 10

	constructor(plugin: MediaDbPlugin) {
		super();

		this.plugin = plugin;
		this.apiName = 'OMDbAPI';
		this.apiDescription = 'A free API for Movies, Series and Games.';
		this.apiUrl = 'https://www.omdbapi.com/';
		this.types = [MediaType.Movie, MediaType.Series, MediaType.Game];
		this.typeMappings = new Map<string, string>();
		this.typeMappings.set('movie', 'movie');
		this.typeMappings.set('series', 'series');
		this.typeMappings.set('game', 'game');
	}

	async makeSearchRequest(searchOptions: SearchOptions): Promise<SearchResponse> {
		const { mediaType, page, title } = searchOptions;
		let url = `${this.baseUrl}/?apikey=${this.plugin.settings.OMDbKey}&s=${encodeURIComponent(title)}`
		if (mediaType) {
			url += `&type=${encodeURIComponent(mediaType)}`;
		}
		if (page) {
			url += `&page=${encodeURIComponent(page)}`;
		}
		const response = await requestUrl(url);

		if (response.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (response.status !== 200) {
			throw Error(`MDB | Received status code ${response.status} from ${this.apiName}.`);
		}

		const data = response.json as SearchResponse | undefined;

		if (!data) {
			throw Error(`MDB | No data received from ${this.apiName}.`);
		}
		return data
	}

	parseSearchResult(result: SearchResult): MediaTypeModel | undefined {
		const type = this.typeMappings.get(result.Type.toLowerCase());
		if (type === undefined) return undefined;

		switch (type) {
			case 'movie':
				return new MovieModel({
					type: type,
					title: result.Title,
					englishTitle: result.Title,
					year: result.Year,
					dataSource: this.apiName,
					id: result.imdbID,
				})
			case 'series':
				return new SeriesModel({
					type: type,
					title: result.Title,
					englishTitle: result.Title,
					year: result.Year,
					dataSource: this.apiName,
					id: result.imdbID,
				})
			case 'game':
				return new GameModel({
					type: type,
					title: result.Title,
					englishTitle: result.Title,
					year: result.Year,
					dataSource: this.apiName,
					id: result.imdbID,
				})
			default:
				return undefined;
		}
	}

	async searchByTitle(title: string, queryOptions: ApiQueryOptions = {} ): Promise<MediaTypeModel[]> {
		const { page, mediaType } = queryOptions;
		console.debug(`MDB | api "${this.apiName}" queried`, { title, mediaType });

		if (!this.plugin.settings.OMDbKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const data = await this.makeSearchRequest({ title, mediaType, page });

		if (data.Response === 'False') {
			if (data.Error === 'Movie not found!') {
				return [];
			}

			throw Error(`MDB | Received error from ${this.apiName}: ${data.Error}`);
		}
		if (!data.Search) {
			return [];
		}

		const ret: MediaTypeModel[] = [];

		for (const result of data.Search) {
			const parsedResult = this.parseSearchResult(result);
			if (!parsedResult) continue;
			ret.push(parsedResult);
		}

		return ret;
	}

	async makeIdRequest(id: string, mediaType?: string): Promise<IdResponse> {
		let url = `${this.baseUrl}/?apikey=${this.plugin.settings.OMDbKey}&i=${encodeURIComponent(id)}`
		if (mediaType) {
			url += `&type=${encodeURIComponent(mediaType)}`;
		}
		const response = await requestUrl(url);
		if (response.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (response.status !== 200) {
			throw Error(`MDB | Received status code ${response.status} from ${this.apiName}.`);
		}
		const result = response.json as IdResponse | undefined;
		if (!result) {
			throw Error(`MDB | No data received from ${this.apiName}.`);
		}

		if (result.Response === 'False') {
			throw Error(`MDB | Received error from ${this.apiName}: ${result.Error}`);
		}
		return result
	}

	parseIdResponse(result: IdResponse): MovieModel | SeriesModel | GameModel | undefined {
		if (result.Response === 'False') {
			throw Error(`MDB | Received error from ${this.apiName}: ${result.Error}`);
		}

		const type = this.typeMappings.get(result.Type.toLowerCase());
		if (type === undefined) {
			throw Error(`${result.Type.toLowerCase()} is an unsupported type.`);
		}

		if (type === 'movie') {
			return new MovieModel({
				type: type,
				title: result.Title,
				englishTitle: result.Title,
				year: result.Year,
				dataSource: this.apiName,
				url: `https://www.imdb.com/title/${result.imdbID}/`,
				id: result.imdbID,

				plot: result.Plot,
				genres: result.Genre?.split(', '),
				director: result.Director?.split(', '),
				writer: result.Writer?.split(', '),
				duration: result.Runtime,
				onlineRating: Number.parseFloat(result.imdbRating ?? 0),
				actors: result.Actors?.split(', '),
				image: result.Poster.replace('_SX300', '_SX600'),

				released: true,
				country: result.Country?.split(', '),
				boxOffice: result.BoxOffice,
				ageRating: result.Rated,
				premiere: this.plugin.dateFormatter.format(result.Released, this.apiDateFormat),

				userData: {
					watched: false,
					lastWatched: '',
					personalRating: 0,
				},
			});
		} else if (type === 'series') {
			return new SeriesModel({
				type: type,
				title: result.Title,
				englishTitle: result.Title,
				year: result.Year,
				dataSource: this.apiName,
				url: `https://www.imdb.com/title/${result.imdbID}/`,
				id: result.imdbID,

				plot: result.Plot,
				genres: result.Genre?.split(', '),
				writer: result.Writer?.split(', '),
				studio: [],
				episodes: 0,
				duration: result.Runtime,
				onlineRating: Number.parseFloat(result.imdbRating ?? 0),
				actors: result.Actors?.split(', '),
				image: result.Poster.replace('_SX300', '_SX600'),

				released: true,
				country: result.Country?.split(', '),
				ageRating: result.Rated,
				airedFrom: this.plugin.dateFormatter.format(result.Released, this.apiDateFormat),

				userData: {
					watched: false,
					lastWatched: '',
					personalRating: 0,
				},
			});
		} else if (type === 'game') {
			return new GameModel({
				type: type,
				title: result.Title,
				englishTitle: result.Title,
				year: result.Year,
				dataSource: this.apiName,
				url: `https://www.imdb.com/title/${result.imdbID}/`,
				id: result.imdbID,

				genres: result.Genre?.split(', '),
				onlineRating: Number.parseFloat(result.imdbRating ?? 0),
				image: result.Poster.replace('_SX300', '_SX600'),

				released: true,
				releaseDate: this.plugin.dateFormatter.format(result.Released, this.apiDateFormat),

				userData: {
					played: false,
					personalRating: 0,
				},
			});
		}
		return undefined;
	}

	async getById(id: string, mediaType?: MediaType): Promise<MediaTypeModel> {
		console.debug(`MDB | api "${this.apiName}" queried by ID`);

		if (!this.plugin.settings.OMDbKey) {
			throw Error(`MDB | API key for ${this.apiName} missing.`);
		}

		const result = await this.makeIdRequest(id, mediaType);
		const parsedResult = this.parseIdResponse(result);
		if (!parsedResult) {
			throw new Error(`MDB | Unknown media type for id ${id}`);
		}
		return parsedResult;
	}

	getDisabledMediaTypes(): MediaType[] {
		return this.plugin.settings.OMDbAPI_disabledMediaTypes;
	}
}
