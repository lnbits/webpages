window.PageWebpages = {
  template: '#page-webpages',
  delimiters: ['${', '}'],
  data() {
    return {
      files: [],
      images: [],
      filter: '',
      currentPath: '',
      content: '',
      savedContent: '',
      splitter: 40,
      saving: false,
      lastSavedAt: '',
      isNewFile: false,
      previewKey: 0,
      uploadingAsset: false,
      codeEditor: null,
      codeMirrorReady: false,
      isEditorSyncing: false,
      newDialog: {
        show: false,
        path: '',
        template: 'html',
        templates: [
          {label: 'HTML Page', value: 'html'},
          {label: 'CSS File', value: 'css'},
          {label: 'JS File', value: 'js'}
        ]
      },
      caddyDialog: {
        show: false
      }
    }
  },
  computed: {
    filteredFiles() {
      if (!this.filter) {
        return this.files
      }
      const needle = this.filter.toLowerCase()
      return this.files.filter(file => file.path.toLowerCase().includes(needle))
    },
    filteredImages() {
      if (!this.filter) {
        return this.images
      }
      const needle = this.filter.toLowerCase()
      return this.images.filter(image =>
        image.path.toLowerCase().includes(needle)
      )
    },
    isHtml() {
      return this.currentPath.endsWith('.html')
    },
    dirty() {
      return this.currentPath && this.content !== this.savedContent
    },
    canOpenLive() {
      return this.currentPath && this.currentPath.endsWith('.html')
    },
    liveUrl() {
      if (!this.canOpenLive) {
        return '#'
      }
      return `/webpages/static/pages/${this.currentPath}`
    },
    previewFrameUrl() {
      if (!this.canOpenLive) {
        return 'about:blank'
      }
      return `${this.liveUrl}?v=${this.previewKey}`
    },
    caddySample() {
      const lnbitsHost = 'lnbits.yoursite.com'
      const siteHost = 'yoursite.com'
      const targetPath =
        this.currentPath && this.currentPath.endsWith('.html')
          ? this.currentPath
          : 'index.html'
      return (
        `${lnbitsHost} {\n` +
        `  encode zstd gzip\n` +
        `  reverse_proxy 127.0.0.1:5000\n` +
        `}\n\n` +
        `${siteHost} {\n` +
        `  encode zstd gzip\n` +
        `\n` +
        `  # Serve homepage at /\n` +
        `  @root path /\n` +
        `  rewrite @root /webpages/static/pages/${targetPath}\n` +
        `\n` +
        `  # Keep clean URLs at the site root for pages and assets\n` +
        `  @pages path *.html /styles.css /assets/*\n` +
        `  rewrite @pages /webpages/static/pages{uri}\n` +
        `\n` +
        `  # Forward requests to LNbits where WebPages files are served\n` +
        `  reverse_proxy 127.0.0.1:5000\n` +
        `}\n`
      )
    }
  },
  watch: {
    splitter() {
      if (!this.codeEditor) {
        return
      }
      requestAnimationFrame(() => this.codeEditor && this.codeEditor.refresh())
    },
    currentPath() {
      this.updateCodeEditorState()
      if (this.isHtml) {
        this.updatePreview()
      }
    }
  },
  async created() {
    await this.refreshAll()
  },
  async mounted() {
    await this.ensureCodeMirror()
    this.initCodeEditor()
  },
  beforeUnmount() {
    this.destroyCodeEditor()
  },
  methods: {
    async ensureCodeMirror() {
      if (this.codeMirrorReady && window.CodeMirror) {
        return
      }

      if (!document.getElementById('webpages-codemirror-css')) {
        const link = document.createElement('link')
        link.id = 'webpages-codemirror-css'
        link.rel = 'stylesheet'
        link.href = '/webpages/static/vendor/codemirror/codemirror.min.css'
        document.head.appendChild(link)
      }

      await this.loadScriptOnce(
        '/webpages/static/vendor/codemirror/codemirror.min.js'
      )
      await this.loadScriptOnce(
        '/webpages/static/vendor/codemirror/mode/xml/xml.min.js'
      )
      await this.loadScriptOnce(
        '/webpages/static/vendor/codemirror/mode/javascript/javascript.min.js'
      )
      await this.loadScriptOnce(
        '/webpages/static/vendor/codemirror/mode/css/css.min.js'
      )
      await this.loadScriptOnce(
        '/webpages/static/vendor/codemirror/mode/htmlmixed/htmlmixed.min.js'
      )
      this.codeMirrorReady = Boolean(window.CodeMirror)
    },
    loadScriptOnce(src) {
      window.__webpagesLoadedScripts = window.__webpagesLoadedScripts || {}
      if (window.__webpagesLoadedScripts[src]) {
        return window.__webpagesLoadedScripts[src]
      }
      window.__webpagesLoadedScripts[src] = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`)
        if (existing) {
          if (existing.dataset.loaded === 'true') {
            resolve()
            return
          }
          existing.addEventListener('load', () => resolve(), {once: true})
          existing.addEventListener('error', () => reject(new Error(src)), {
            once: true
          })
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.addEventListener(
          'load',
          () => {
            script.dataset.loaded = 'true'
            resolve()
          },
          {once: true}
        )
        script.addEventListener('error', () => reject(new Error(src)), {
          once: true
        })
        document.head.appendChild(script)
      })
      return window.__webpagesLoadedScripts[src]
    },
    editorModeForPath(path = '') {
      if (path.endsWith('.css')) return 'css'
      if (path.endsWith('.js')) return 'javascript'
      return 'htmlmixed'
    },
    initCodeEditor() {
      if (!window.CodeMirror || !this.$refs.codeEditor || this.codeEditor) {
        return
      }
      this.codeEditor = window.CodeMirror(this.$refs.codeEditor, {
        value: this.content || '',
        mode: this.editorModeForPath(this.currentPath),
        lineNumbers: true,
        lineWrapping: false,
        readOnly: !this.currentPath,
        indentUnit: 2,
        tabSize: 2,
        indentWithTabs: false
      })
      this.codeEditor.on('change', () => {
        if (this.isEditorSyncing) {
          return
        }
        this.content = this.codeEditor.getValue()
      })
      this.updateCodeEditorState()
      this.codeEditor.refresh()
    },
    destroyCodeEditor() {
      if (!this.codeEditor) {
        return
      }
      this.codeEditor.toTextArea?.()
      this.codeEditor = null
    },
    updateCodeEditorState() {
      if (!this.codeEditor) {
        return
      }
      this.codeEditor.setOption(
        'mode',
        this.editorModeForPath(this.currentPath)
      )
      this.codeEditor.setOption('readOnly', !this.currentPath)
    },
    setEditorValue(value) {
      if (!this.codeEditor) {
        return
      }
      const nextValue = value || ''
      if (this.codeEditor.getValue() === nextValue) {
        return
      }
      this.isEditorSyncing = true
      this.codeEditor.setValue(nextValue)
      this.codeEditor.clearHistory()
      this.isEditorSyncing = false
    },
    formatDate(value) {
      try {
        const date = new Date(value)
        return date.toLocaleString()
      } catch (err) {
        return value
      }
    },
    formatSize(bytes) {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    },
    assetUrl(path) {
      return `${window.location.origin}/webpages/static/pages/${path}`
    },
    normalizePath(value) {
      return value.replace(/^\/+/, '')
    },
    async refreshAll() {
      await Promise.all([this.refreshFiles(), this.refreshImages()])
    },
    ensurePathExtension(path, template) {
      if (/\.(html|css|js)$/i.test(path)) {
        return path
      }
      if (template === 'css') {
        return `${path}.css`
      }
      if (template === 'js') {
        return `${path}.js`
      }
      return `${path}.html`
    },
    updatePreview() {
      this.previewKey += 1
    },
    openCaddyDialog() {
      this.caddyDialog.show = true
    },
    async copyCaddySample() {
      try {
        await navigator.clipboard.writeText(this.caddySample)
        this.$q.notify({type: 'positive', message: 'Copied to clipboard.'})
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Clipboard copy failed. Copy manually from the dialog.'
        })
      }
    },
    openNewDialog() {
      this.newDialog.show = true
      this.newDialog.path = ''
      this.newDialog.template = 'html'
    },
    templateFor(kind) {
      if (kind === 'css') {
        return `/* Styles for WebPages */\nbody {\n  font-family: sans-serif;\n}`
      }
      if (kind === 'js') {
        return `// JavaScript for WebPages\nconsole.log('WebPages ready')`
      }
      return (
        '<!doctype html>\n' +
        '<html>\n' +
        '  <head>\n' +
        '    <meta charset="utf-8">\n' +
        '    <title>New Page</title>\n' +
        '    <link rel="stylesheet" href="styles.css">\n' +
        '  </head>\n' +
        '  <body>\n' +
        '    <h1>Hello from WebPages</h1>\n' +
        '    <script src="app.js"></script>\n' +
        '  </body>\n' +
        '</html>\n'
      )
    },
    async createFile() {
      const rawPath = this.newDialog.path.trim()
      if (!rawPath) {
        this.$q.notify({type: 'negative', message: 'File path is required.'})
        return
      }
      const normalizedPath = this.ensurePathExtension(
        this.normalizePath(rawPath),
        this.newDialog.template
      )
      const templateContent = this.templateFor(this.newDialog.template)
      try {
        await LNbits.api.request('POST', '/webpages/api/v1/pages', null, {
          path: normalizedPath,
          content: templateContent
        })
        this.currentPath = normalizedPath
        this.content = templateContent
        this.savedContent = templateContent
        this.setEditorValue(this.content)
        this.isNewFile = false
        this.newDialog.show = false
        if (this.isHtml) {
          this.updatePreview()
        }
        await this.refreshFiles()
        this.$q.notify({type: 'positive', message: 'File created.'})
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    async refreshFiles() {
      try {
        const {data} = await LNbits.api.request('GET', '/webpages/api/v1/pages')
        this.files = data.files || []
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    async refreshImages() {
      try {
        const {data} = await LNbits.api.request(
          'GET',
          '/webpages/api/v1/pages/assets'
        )
        this.images = data.files || []
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    openAssetPicker() {
      if (this.uploadingAsset) {
        return
      }
      this.$refs.assetInput?.click()
    },
    async onAssetSelected(event) {
      const [file] = event.target.files || []
      if (!file) {
        return
      }
      this.uploadingAsset = true
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'assets')
      try {
        const {data} = await LNbits.api.request(
          'POST',
          '/webpages/api/v1/pages/assets',
          null,
          formData,
          {
            headers: {'Content-Type': 'multipart/form-data'}
          }
        )
        await this.refreshImages()
        this.$q.notify({type: 'positive', message: `Uploaded ${data.path}`})
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.uploadingAsset = false
        event.target.value = ''
      }
    },
    async copyAssetUrl(path) {
      try {
        await navigator.clipboard.writeText(this.assetUrl(path))
        this.$q.notify({type: 'positive', message: 'Image URL copied.'})
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Clipboard copy failed. Copy manually.'
        })
      }
    },
    async confirmDeleteAsset(path) {
      this.$q
        .dialog({
          title: 'Delete image?',
          message: path,
          cancel: true,
          persistent: true
        })
        .onOk(async () => {
          await this.deleteAsset(path)
        })
    },
    async deleteAsset(path) {
      try {
        await LNbits.api.request(
          'DELETE',
          `/webpages/api/v1/pages/assets/${encodeURI(path)}`
        )
        await this.refreshImages()
        this.$q.notify({type: 'positive', message: 'Image deleted.'})
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    async selectFile(path) {
      try {
        const safePath = this.normalizePath(path)
        const {data} = await LNbits.api.request(
          'GET',
          `/webpages/api/v1/pages/content/${encodeURI(safePath)}`
        )
        this.currentPath = safePath
        this.content = data.content || ''
        this.savedContent = this.content
        this.setEditorValue(this.content)
        this.isNewFile = false
        if (this.isHtml) {
          this.updatePreview()
        }
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    async saveFile() {
      if (!this.currentPath) {
        return
      }
      if (this.saving) {
        return
      }
      if (this.content === this.savedContent) {
        return
      }
      this.saving = true
      try {
        const payload = {
          path: this.currentPath,
          content: this.content || ''
        }
        await LNbits.api.request(
          'POST',
          '/webpages/api/v1/pages',
          null,
          payload
        )
        this.savedContent = this.content
        this.lastSavedAt = new Date().toLocaleTimeString()
        this.isNewFile = false
        if (this.isHtml) {
          this.updatePreview()
        }
        await this.refreshFiles()
        this.$q.notify({type: 'positive', message: 'Saved.'})
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.saving = false
      }
    },
    async confirmDelete(path = null) {
      const targetPath = this.normalizePath(path || this.currentPath || '')
      if (!targetPath) {
        return
      }
      this.$q
        .dialog({
          title: 'Delete file?',
          message: targetPath,
          cancel: true,
          persistent: true
        })
        .onOk(async () => {
          await this.deleteFile(targetPath)
        })
    },
    async deleteFile(path = null) {
      const targetPath = this.normalizePath(path || this.currentPath || '')
      if (!targetPath) {
        return
      }
      try {
        await LNbits.api.request(
          'DELETE',
          `/webpages/api/v1/pages/${encodeURI(targetPath)}`
        )
        if (targetPath === this.currentPath) {
          this.currentPath = ''
          this.content = ''
          this.savedContent = ''
          this.setEditorValue('')
          this.isNewFile = false
        }
        await this.refreshFiles()
        this.$q.notify({type: 'positive', message: 'Deleted.'})
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    }
  }
}
