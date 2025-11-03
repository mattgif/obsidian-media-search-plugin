import type { ButtonComponent } from 'obsidian';
import { Modal, Notice, Setting, SearchComponent, SuggestModal } from 'obsidian';
import type { APIManager } from '../api/APIManager';
import type { APIModel } from '../api/APIModel';
import type MediaDbPlugin from '../main';
import type { ApiQueryResponse } from '../models/Api';
import type {MediaTypeModel} from '../models/MediaTypeModel';
import { MediaType } from '../utils/MediaType';
import type { AdvancedSearchModalData, MediaQueryModalOptions } from '../utils/ModalHelper';
import { MEDIA_QUERY_MODAL_DEFAULT_OPTIONS } from '../utils/ModalHelper';
import { asyncDebounce } from '../utils/Utils';


export class MediaQuerySearchModal extends SuggestModal<MediaTypeModel> {
	plugin: MediaDbPlugin;

	query: string;
	isBusy: boolean;
	title: string;
	selectedApi?: APIModel;
	searchBtn?: ButtonComponent;
	results: MediaTypeModel[] = [];
	debouncedSearch: (query: string, api: APIModel, mediaType: MediaType) => Promise<MediaTypeModel[]>

	apiManager: APIManager;
	private _selectedMediaType: MediaType = MEDIA_QUERY_MODAL_DEFAULT_OPTIONS.defaultMediaType;

	submitCallback?: (res: AdvancedSearchModalData) => void;
	closeCallback?: (err?: Error) => void;

	constructor(plugin: MediaDbPlugin, apiManager: APIManager, mediaQueryModalOptions: MediaQueryModalOptions = {}) {
		super(plugin.app);

		const opts = Object.assign(MEDIA_QUERY_MODAL_DEFAULT_OPTIONS, mediaQueryModalOptions);

		this.plugin = plugin;
		this.apiManager = apiManager;

		this.title = opts.modalTitle;
		this.query = opts.prefilledSearchString;
		this.isBusy = false;
		this.selectedMediaType = opts.defaultMediaType;
		this.debouncedSearch = asyncDebounce(this.search, 700)
	}

	set selectedMediaType(value: MediaType) {
		console.log('setting media type', value);
		this._selectedMediaType = value;
		// TODO: figure out why manager doesn't work after changing media type
		this.selectedApi = this.apiManager.getApiByMediaType(value);
	}

	get selectedMediaType(): MediaType {
		return this._selectedMediaType;
	}

	setSubmitCallback(submitCallback: (res: AdvancedSearchModalData) => void): void {
		this.submitCallback = submitCallback;
	}

	setCloseCallback(closeCallback: (err?: Error) => void): void {
		this.closeCallback = closeCallback;
	}

	async getSuggestions(query: string): Promise<MediaTypeModel[]> {
		if (!query || query.length < 3) {
			// new Notice('MQ | Query too short');
			return [];
		}
		if (!this.selectedApi) {
			new Notice('MQ | No API available for this media type');
			return [];
		}
		const results = await this.debouncedSearch(query, this.selectedApi, this.selectedMediaType);
		this.results = results;
		return results;
	}

	renderSuggestion(item: MediaTypeModel, el: HTMLElement) {
		el.createEl('div', { text: this.plugin.mediaTypeManager.getFileName(item) });
		el.createEl('small', { text: `${item.getSummary()}\n` });
		el.createEl('small', { text: `${item.type.toUpperCase() + (item.subType ? ` (${item.subType})` : '')} from ${item.dataSource}` });
	}

	onChooseSuggestion(item: MediaTypeModel, evt: MouseEvent | KeyboardEvent) {

	}

	search= async (query: string, api: APIModel, mediaType: MediaType): Promise<MediaTypeModel[]> => {
		// let loading = this.resultContainerEl.querySelector('#search-loading');
		// if (loading) {
		// 	loading = this.resultContainerEl.createEl('small', { text: `Searching ${this.selectedApi?.apiName}...` })
		// 	loading.setAttribute('id', 'search-loading');
		// }

		console.log({
			query,
			mediaType,
			api,
		})

		try {
			const res = await api.searchByTitle(query, { mediaType });
			console.log(res);

			if ('results' in res) {
				return res.results;
			} else {
				return res;
			}
		} catch (e) {
			return []
		} finally {
			// loading?.remove()
		}
	}

	onOpen(): void {
		this.renderHeader()

		// inputEl.insertBefore()
		//
		// const title = createEl('h2', { text: this.title, cls: 'search__title' });
		// modalEl.prepend(title)
		// this.renderSelectMediaType();
		// this.renderSearchInput();

		// contentEl.createDiv({ cls: 'media-db-plugin-spacer' });
		//
		// new Setting(contentEl)
		// 	.addButton(btn => {
		// 		btn.setButtonText('Cancel');
		// 		btn.onClick(() => this.close());
		// 		btn.buttonEl.addClass('media-db-plugin-button');
		// 	})
		// 	.addButton(btn => {
		// 		btn.setButtonText('Ok');
		// 		btn.setCta();
		// 		btn.onClick(() => {
		// 			void this.search();
		// 		});
		// 		btn.buttonEl.addClass('media-db-plugin-button');
		// 		this.searchBtn = btn;
		// 	});
	}

	renderHeader() {
		const { modalEl } = this;
		const header = modalEl.createEl('div', { cls: 'search__header' });
		modalEl.prepend(header);
		// const title = header.createEl('h2', { text: this.title, cls: 'search__title' });
		new Setting(header).setName('MediaType').addDropdown(dropdown => {
			Object.entries(MediaType).forEach(([display, type]) => {
				dropdown.addOption(type, display);
			});
			dropdown.setValue(this.selectedMediaType).onChange(mediaType => (this.selectedMediaType = mediaType as MediaType));
		});
	}

	// renderSelectMediaType(): void {
	// 	new Setting(this.contentEl).setName('MediaType').addDropdown(dropdown => {
	// 		Object.entries(MediaType).forEach(([display, type]) => {
	// 			dropdown.addOption(type, display);
	// 		});
	// 		dropdown.setValue(this.selectedMediaType).onChange(mediaType => (this.selectedMediaType = mediaType as MediaType));
	// 	});
	// }

	onClose(): void {
		this.closeCallback?.();
		const { contentEl } = this;
		contentEl.empty();
	}
}
