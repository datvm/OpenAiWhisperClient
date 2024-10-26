customElements.get("whisper-app") ?? customElements.define("whisper-app", class extends HTMLElement {

    #txtKey: HTMLInputElement = this.querySelector("#txt-key")!;
    #txtFile: HTMLInputElement = this.querySelector("#txt-file")!;
    #cboResponseFormat: HTMLSelectElement = this.querySelector("#cbo-response-format")!;
    #cboTimestampGranularities: HTMLSelectElement = this.querySelector("#cbo-timestamp-granularities")!;
    #txtPrompt: HTMLTextAreaElement = this.querySelector("#txt-prompt")!;
    #txtTemperature: HTMLInputElement = this.querySelector("#txt-temperature")!;
    #lblTemperature: HTMLSpanElement = this.querySelector("#lbl-temperature")!;
    #cboLanguage: HTMLSelectElement = this.querySelector("#cbo-language")!;

    #frmUpload: HTMLFormElement = this.querySelector("#frm-upload")!;
    #btnSubmit: HTMLButtonElement = this.querySelector("#btn-submit")!;
    #btnSubmitSpinner: HTMLElement = this.querySelector("#btn-submit-spinner")!;

    #result: string = "";
    #resultFormat: string = "";
    #txtResult: HTMLTextAreaElement = this.querySelector("#txt-result")!;

    #pnlError: HTMLElement = this.querySelector("#pnl-error")!;
    #pnlResult: HTMLElement = this.querySelector("#pnl-result")!;
    #submitting = false;

    #btnCopy: HTMLButtonElement = this.querySelector("#btn-copy")!;
    #btnDownload: HTMLButtonElement = this.querySelector("#btn-download")!;

    constructor() {
        super();

        void this.#initAsync();
    }

    async #initAsync() {
        await this.#fillLanguagesAsync();

        this.#cboResponseFormat.addEventListener("change", () => void this.#onFormatChanged());
        this.#txtTemperature.addEventListener("input", () => void this.#onTempChanged());

        this.#btnCopy.addEventListener("click", () => void this.#copyAsync());
        this.#btnDownload.addEventListener("click", () => void this.#downloadAsync());

        this.#frmUpload.addEventListener("submit", e => {
            e.preventDefault();
            void this.#submitAsync();
        });
    }

    async #submitAsync() {
        if (this.#submitting) { return; }

        try {
            this.#setLoading(true);
            this.#setDisplay(this.#pnlError, false);
            this.#setDisplay(this.#pnlResult, false);

            const reqBody = this.#getRequestContent();
            if (!reqBody) { return; }
            this.#resultFormat = this.#cboResponseFormat.value;

            const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.#txtKey.value}`,
                },
                body: reqBody,
            });

            const content = await res.text();
            if (res.ok) {
                this.#result = content;
                this.#displayResult();
            } else {
                throw new Error(`Error ${res.status} (${res.statusText}): ${content}`);
            }
        } catch (e) {
            this.#showError(e);
        } finally {
            this.#setLoading(false);
        }
    }

    #displayResult() {
        this.#txtResult.value = this.#result;

        this.#setDisplay(this.#pnlResult, true);
    }

    #getRequestContent(): FormData | undefined {
        const file = this.#txtFile.files?.[0];
        if (!file) {
            alert("No file selected");
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            if (!confirm("File size exceeds 25MB. Do you still want to proceed?")) {
                return;
            }
        }

        const form = new FormData();

        form.append("file", file);
        form.append("model", "whisper-1");

        this.#appendIfNotEmpty(form, "language", this.#cboLanguage.value);
        this.#appendIfNotEmpty(form, "prompt", this.#txtPrompt.value);
        form.append("response_format", this.#cboResponseFormat.value);
        form.append("temperature", this.#txtTemperature.value.toString());

        if (this.#isJsonVerbose) {
            form.append("timestamp_granularity", this.#cboTimestampGranularities.value);
        }

        return form;
    }

    #setLoading(loading: boolean) {
        this.#btnSubmit.disabled = loading;
        this.#btnSubmitSpinner.classList.toggle("d-none", !loading);
        this.#submitting = loading;
    }

    #appendIfNotEmpty(form: FormData, key: string, value: string) {
        if (value) {
            form.append(key, value);
        }
    }

    #showError(e: any) {
        console.error(e);

        this.#pnlError.textContent = e instanceof Error ? e.message : e.toString();
        this.#setDisplay(this.#pnlError, true);
    }

    async #fillLanguagesAsync() {
        const langs = await fetch("/languages.json")
            .then<ILanguage[]>(r => r.json());

        const frag = new DocumentFragment();

        { // Add none option
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "Do not specify";

            frag.appendChild(opt);
        }

        for (const lang of langs) {
            const opt = document.createElement("option");
            opt.value = lang.code;
            opt.textContent = `${lang.name} (${lang.nativeName}) - ${lang.code}`;

            frag.appendChild(opt);
        }

        this.#cboLanguage.innerHTML = "";
        this.#cboLanguage.appendChild(frag);
    }

    #onTempChanged() {
        this.#lblTemperature.textContent = Math.floor(Number(this.#txtTemperature.value) * 100).toString();
    }

    #onFormatChanged() {
        this.#cboTimestampGranularities.disabled = !this.#isJsonVerbose;
    }

    #setDisplay(el: HTMLElement, visible: boolean) {
        el.classList.toggle("d-none", !visible);
    }

    get #isJsonVerbose() {
        return this.#cboResponseFormat.value === "verbose_json";
    }

    async #copyAsync() {
        await navigator.clipboard.writeText(this.#result);
    }

    async #downloadAsync() {
        const blob = new Blob([this.#result], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        let extension: string;
        switch (this.#resultFormat) {
            case "json":
            case "verbose_json":
                extension = "json";
                break;
            case "srt":
                extension = "srt";
                break;
            case "vtt":
                extension = "vtt";
                break;
            default:
                extension = "txt";
                break;
        }

        const fileName = "transcript." + extension;

        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(url);
    }

});