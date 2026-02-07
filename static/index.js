window.PageWebpages = {
  template: '#page-webpages',
  delimiters: ['${', '}'],
  data() {
    return {
      files: [],
      filter: '',
      currentPath: '',
      content: '',
      savedContent: '',
      splitter: 40,
      saving: false,
      autosaving: false,
      lastSavedAt: '',
      isNewFile: false,
      autosaveTimer: null,
      autosaveDelay: 700,
      previewKey: 0,
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
    editorLanguage() {
      if (this.currentPath.endsWith('.css')) return 'css'
      if (this.currentPath.endsWith('.js')) return 'js'
      return 'html'
    },
    highlightedContent() {
      return this.highlightCode(this.content || '', this.editorLanguage)
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
        `  # Forward requests to LNbits where WebPages files are served\n` +
        `  reverse_proxy 127.0.0.1:5000\n` +
        `\n` +
        `  # Optional: serve your selected page at / without showing index.html in URL\n` +
        `  @root path /\n` +
        `  rewrite @root /webpages/static/pages/${targetPath}\n` +
        `}\n`
      )
    }
  },
  watch: {
    currentPath() {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
      if (this.isHtml) {
        this.updatePreview()
      }
    }
  },
  async created() {
    await this.refreshFiles()
  },
  beforeUnmount() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer)
      this.autosaveTimer = null
    }
  },
  methods: {
    onContentChange(val) {
      this.content = val
      this.scheduleAutosave()
    },
    syncEditorScroll() {
      if (!this.$refs.inputLayer || !this.$refs.highlightLayer) {
        return
      }
      this.$refs.highlightLayer.scrollTop = this.$refs.inputLayer.scrollTop
      this.$refs.highlightLayer.scrollLeft = this.$refs.inputLayer.scrollLeft
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
    normalizePath(value) {
      return value.replace(/^\/+/, '')
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
    escapeHtml(value) {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    },
    highlightCode(content, language) {
      if (!content) {
        return ''
      }

      let highlighted = this.escapeHtml(content)
      const protectedTokens = []
      const protect = (regex, cssClass) => {
        highlighted = highlighted.replace(regex, match => {
          const tokenId = `___TOKEN_${protectedTokens.length}___`
          protectedTokens.push(`<span class="${cssClass}">${match}</span>`)
          return tokenId
        })
      }

      protect(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, 'tok-comment')
      protect(
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`])*`)/g,
        'tok-string'
      )

      highlighted = highlighted.replace(
        /\b(\d+(?:\.\d+)?)\b/g,
        '<span class="tok-number">$1</span>'
      )

      if (language === 'js') {
        highlighted = highlighted.replace(
          /\b(const|let|var|function|return|if|else|for|while|class|new|import|export|async|await|try|catch|throw)\b/g,
          '<span class="tok-keyword">$1</span>'
        )
      } else if (language === 'css') {
        highlighted = highlighted.replace(
          /\b(@media|@import|@keyframes|display|position|color|background|font-size|font-family|padding|margin|border|width|height)\b/g,
          '<span class="tok-keyword">$1</span>'
        )
      } else {
        highlighted = highlighted.replace(
          /(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)([^&]*?&gt;)/g,
          '$1<span class="tok-tag">$2</span>$3'
        )
      }

      highlighted = highlighted.replace(/___TOKEN_(\d+)___/g, (_, index) => {
        return protectedTokens[Number(index)] || ''
      })

      return highlighted
    },
    scheduleAutosave() {
      if (!this.currentPath || this.content === this.savedContent) {
        return
      }
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
      }
      this.autosaveTimer = setTimeout(() => {
        this.saveFile({isAutosave: true})
      }, this.autosaveDelay)
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
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
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
    async selectFile(path) {
      try {
        if (this.autosaveTimer) {
          clearTimeout(this.autosaveTimer)
          this.autosaveTimer = null
        }
        const safePath = this.normalizePath(path)
        const {data} = await LNbits.api.request(
          'GET',
          `/webpages/api/v1/pages/content/${encodeURI(safePath)}`
        )
        this.currentPath = safePath
        this.content = data.content || ''
        this.savedContent = this.content
        this.isNewFile = false
        if (this.isHtml) {
          this.updatePreview()
        }
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    async saveFile(options = {}) {
      if (!this.currentPath) {
        return
      }
      if (this.saving || this.autosaving) {
        return
      }
      if (this.content === this.savedContent && options.isAutosave) {
        return
      }
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
      if (options.isAutosave) {
        this.autosaving = true
      } else {
        this.saving = true
      }
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
        if (options.isAutosave) {
          await this.refreshFiles()
        } else {
          await this.refreshFiles()
          this.$q.notify({type: 'positive', message: 'Saved.'})
        }
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.saving = false
        this.autosaving = false
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
        if (this.autosaveTimer) {
          clearTimeout(this.autosaveTimer)
          this.autosaveTimer = null
        }
        await LNbits.api.request(
          'DELETE',
          `/webpages/api/v1/pages/${encodeURI(targetPath)}`
        )
        if (targetPath === this.currentPath) {
          this.currentPath = ''
          this.content = ''
          this.savedContent = ''
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
