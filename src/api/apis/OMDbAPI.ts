import { requestUrl } from 'obsidian';
import type MediaDbPlugin from '../../main';
import type { ApiQueryOptions, ApiQueryResponse } from '../../models/Api';
import { GameModel } from '../../models/GameModel';
import type { MediaTypeModel } from '../../models/MediaTypeModel';
import { MovieModel } from '../../models/MovieModel';
import { SeriesModel } from '../../models/SeriesModel';
import { MediaType } from '../../utils/MediaType';
import { APIModel } from '../APIModel';

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

export class OMDbAPI extends APIModel {
	plugin: MediaDbPlugin;
	typeMappings = new Map<string, MediaType>();
	apiName = 'OMDbAPI';
	apiDateFormat: string = 'DD MMM YYYY';
	apiUrl = 'https://www.omdbapi.com/';
	apiDescription = 'A free API for Movies, Series and Games.';
	perPage: number = 10;

	constructor(plugin: MediaDbPlugin) {
		super();

		this.plugin = plugin;
		this.typeMappings.set('movie', MediaType.Movie);
		this.typeMappings.set('series', MediaType.Series);
		this.typeMappings.set('game', MediaType.Game);
		this.types = Array.from(this.typeMappings.values());
	}

	parseSearchResult(result: SearchResult): MediaTypeModel | undefined {
		const type = this.typeMappings.get(result.Type.toLowerCase());
		if (!type) return undefined;
		const data = {
			type: type,
			title: result.Title,
			englishTitle: result.Title,
			year: result.Year,
			dataSource: this.apiName,
			id: result.imdbID,
		};
		switch (type) {
			case MediaType.Movie:
				return new MovieModel(data);
			case MediaType.Series:
				return new SeriesModel(data);
			case MediaType.Game:
				return new GameModel(data);
			default:
				return undefined;
		}
	}

	calculatePageFromOffset(offset: number): number {
		return Math.floor((offset + this.perPage) / this.perPage);
	}

	async searchByTitle(title: string, queryOptions: ApiQueryOptions = {}): Promise<ApiQueryResponse> {
		const { offset, mediaType } = queryOptions;
		const page = offset && this.calculatePageFromOffset(offset);

		console.debug(`MDB | api "${this.apiName}" queried`, { title, mediaType });

		if (!this.plugin.settings.OMDbKey) {
			throw new Error(`MDB | API key for ${this.apiName} missing.`);
		}

		let url = `${this.apiUrl}?apikey=${this.plugin.settings.OMDbKey}&s=${encodeURIComponent(title)}`;
		if (mediaType) {
			url += `&type=${encodeURIComponent(mediaType)}`;
		}
		if (page) {
			url += `&page=${encodeURIComponent(page)}`;
		}
		const omdbResponse = await requestUrl(url);

		if (omdbResponse.status === 401) {
			throw Error(`MDB | Authentication for ${this.apiName} failed. Check the API key.`);
		}
		if (omdbResponse.status !== 200) {
			throw Error(`MDB | Received status code ${omdbResponse.status} from ${this.apiName}.`);
		}

		const data = omdbResponse.json as SearchResponse | undefined;

		if (!data) {
			throw Error(`MDB | No data received from ${this.apiName}.`);
		}

		const res: ApiQueryResponse = {
			offset: offset ?? 0,
			total: 0,
			results: [],
		};

		if (data.Response === 'False') {
			if (data.Error === 'Movie not found!') {
				return res;
			}

			throw Error(`MDB | Received error from ${this.apiName}: ${data.Error}`);
		}
		if (!data.Search) {
			return res;
		}

		res.total = parseInt(data.totalResults);
		for (const result of data.Search) {
			const parsedResult = this.parseSearchResult(result);
			if (!parsedResult) continue;
			res.results.push(parsedResult);
		}

		return res;
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

		let url = `${this.apiUrl}?apikey=${this.plugin.settings.OMDbKey}&i=${encodeURIComponent(id)}`;
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
