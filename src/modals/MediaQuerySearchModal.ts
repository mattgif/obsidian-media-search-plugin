import type { ButtonComponent } from 'obsidian';
import { Modal, Notice, Setting, SearchComponent } from 'obsidian';
import type MediaDbPlugin from '../main';
import { MediaType } from '../utils/MediaType';
import type { AdvancedSearchModalData, AdvancedSearchModalOptions, MediaQueryModalOptions } from '../utils/ModalHelper';
import { MEDIA_QUERY_MODAL_DEFAULT_OPTIONS } from '../utils/ModalHelper';
import type { APIManager } from '../api/APIManager';
import type { APIModel } from '../api/APIModel';

type MediaQuery = {
	query: string;
	mediaType: MediaType;
}

export class MediaQuerySearchModal extends Modal {
	plugin: MediaDbPlugin;

	query: string;
	isBusy: boolean;
	title: string;
	selectedApi?: APIModel;

	searchBtn?: ButtonComponent;

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
	}

	set selectedMediaType(value: MediaType) {
		this._selectedMediaType = value;
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

	keyPressCallback(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			void this.search();
		}
	}

	async search(): Promise<void> {
		if (!this.query || this.query.length < 3) {
			new Notice('MQ | Query too short');
			return;
		}

		if (!this.selectedApi) {
			new Notice('MQ | No API available for this media type');
			return;
		}

		const res = await this.selectedApi.searchByTitle(this.query, this.selectedMediaType);
		console.log(res);

		if (!this.isBusy) {
			this.isBusy = true;
			this.searchBtn?.setDisabled(false);
			this.searchBtn?.setButtonText('Searching...');

			// this.submitCallback?.({ query: this.query, apis: apis });
		}
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.title });
		this.renderSelectMediaType();
		this.renderSearchInput();

		contentEl.createDiv({ cls: 'media-db-plugin-spacer' });

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText('Cancel');
				btn.onClick(() => this.close());
				btn.buttonEl.addClass('media-db-plugin-button');
			})
			.addButton(btn => {
				btn.setButtonText('Ok');
				btn.setCta();
				btn.onClick(() => {
					void this.search();
				});
				btn.buttonEl.addClass('media-db-plugin-button');
				this.searchBtn = btn;
			});
	}

	renderSelectMediaType(): void {
		new Setting(this.contentEl).setName('MediaType').addDropdown(dropdown => {
			Object.entries(MediaType)
				.forEach(([display, type]) => {
					dropdown.addOption(type, display);
				})
			dropdown
				.setValue(this.selectedMediaType)
				.onChange(mediaType => this.selectedMediaType = mediaType as MediaType);

		})
	}

	renderSearchInput(): void {
		const placeholder = 'Search by title';
		const searchComponent = new SearchComponent(this.contentEl);
		searchComponent.setPlaceholder(placeholder);
		searchComponent.setValue(this.query);
		searchComponent.onChange(value => (this.query = value));
		searchComponent.inputEl.addEventListener('keydown', this.keyPressCallback.bind(this));
		searchComponent.inputEl.focus();
	}

	onClose(): void {
		this.closeCallback?.();
		const { contentEl } = this;
		contentEl.empty();
	}
}
