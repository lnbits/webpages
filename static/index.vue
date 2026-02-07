<template id="page-webpages">
  <div class="column window-height webpages-editor-page">
    <div class="row q-col-gutter-md full-height">
      <div class="col-12 col-md-2 column full-height">
        <q-card class="column full-height">
          <q-card-section class="row items-center">
            <div class="text-h6">WebPages</div>
            <q-space></q-space>
            <q-btn
              unelevated
              color="primary"
              label="New File"
              @click="openNewDialog"
            ></q-btn>
          </q-card-section>

          <q-separator></q-separator>

          <q-card-section>
            <q-input dense v-model="filter" label="Filter"></q-input>
          </q-card-section>

          <q-separator></q-separator>

          <q-card-section class="q-pa-none col">
            <q-scroll-area class="fit">
              <q-list dense bordered separator>
                <q-item
                  v-for="file in filteredFiles"
                  :key="file.path"
                  clickable
                  @click="selectFile(file.path)"
                  :active="file.path === currentPath"
                  active-class="bg-grey-2"
                >
                  <q-item-section>
                    <q-item-label>${ file.path }</q-item-label>
                    <q-item-label caption>
                      ${ formatSize(file.size) } · ${
                      formatDate(file.updated_at) }
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      flat
                      dense
                      round
                      size="sm"
                      color="negative"
                      icon="delete"
                      @click.stop="confirmDelete(file.path)"
                    ></q-btn>
                  </q-item-section>
                </q-item>

                <q-item v-if="filteredFiles.length === 0">
                  <q-item-section>
                    <q-item-label caption>No files found.</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-scroll-area>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-10 column full-height">
        <q-card class="column full-height">
          <q-card-section class="row items-center q-gutter-sm">
            <div class="text-h6">Editor</div>
            <q-chip v-if="dirty" color="warning" text-color="black" dense
              >Unsaved</q-chip
            >
            <q-chip v-if="autosaving" color="primary" text-color="white" dense
              >Autosaving...</q-chip
            >
            <q-chip
              v-else-if="lastSavedAt"
              color="positive"
              text-color="white"
              dense
            >
              Saved ${ lastSavedAt }
            </q-chip>
            <q-space></q-space>
            <q-btn flat icon="refresh" @click="refreshFiles"></q-btn>
            <q-btn flat icon="description" @click="openCaddyDialog">
              <q-tooltip
                >Caddyfile sample to serve over reverse_proxy</q-tooltip
              >
            </q-btn>
            <q-btn
              flat
              icon="open_in_new"
              :disable="!canOpenLive"
              :href="liveUrl"
              target="_blank"
            ></q-btn>
          </q-card-section>

          <q-separator></q-separator>

          <q-card-section>
            <q-input
              dense
              label="File Path"
              v-model="currentPath"
              :disable="!isNewFile"
              hint="Only .html, .css, or .js inside static/pages"
            ></q-input>
          </q-card-section>

          <q-separator></q-separator>

          <q-card-section class="q-pa-none col">
            <q-splitter
              v-model="splitter"
              :limits="[20, 80]"
              class="col full-height"
            >
              <template v-slot:before>
                <div class="q-pa-md column full-height">
                  <div class="code-editor-wrap col">
                    <pre
                      ref="highlightLayer"
                      class="code-layer"
                      v-html="highlightedContent"
                    ></pre>
                    <textarea
                      ref="inputLayer"
                      :value="content"
                      @input="onContentChange($event.target.value)"
                      @scroll="syncEditorScroll"
                      :disabled="!currentPath"
                      class="code-input"
                      spellcheck="false"
                    ></textarea>
                  </div>
                </div>
              </template>

              <template v-slot:after>
                <div class="q-pa-md column full-height">
                  <div v-if="isHtml" class="col full-height">
                    <iframe
                      :key="previewKey"
                      :src="previewFrameUrl"
                      sandbox="allow-scripts allow-forms allow-same-origin"
                      class="fit bordered rounded-borders bg-grey-1"
                    ></iframe>
                  </div>

                  <div
                    v-else
                    class="text-caption col full-height flex flex-center"
                  >
                    Preview is available for HTML files. Save CSS/JS and
                    reference them from an HTML page in this folder.
                  </div>
                </div>
              </template>
            </q-splitter>
          </q-card-section>

          <q-separator></q-separator>

          <q-card-actions align="right">
            <q-btn
              flat
              color="negative"
              label="Delete"
              :disable="!currentPath"
              @click="confirmDelete"
            ></q-btn>
            <q-btn
              color="primary"
              label="Save"
              :disable="!currentPath"
              :loading="saving"
              @click="saveFile"
            ></q-btn>
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="newDialog.show">
      <q-card style="min-width: 420px">
        <q-card-section>
          <div class="text-h6">New File</div>
        </q-card-section>
        <q-card-section>
          <q-input
            dense
            v-model="newDialog.path"
            label="File Path"
            hint="Example: landing/index.html"
          ></q-input>
          <q-select
            dense
            v-model="newDialog.template"
            :options="newDialog.templates"
            label="Template"
            emit-value
            map-options
            class="q-mt-md"
          ></q-select>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup></q-btn>
          <q-btn color="primary" label="Create" @click="createFile"></q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="caddyDialog.show">
      <q-card style="min-width: 760px; max-width: 92vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Caddyfile Sample</div>
          <q-space></q-space>
          <q-btn
            flat
            icon="content_copy"
            label="Copy"
            @click="copyCaddySample"
          ></q-btn>
        </q-card-section>
        <q-separator></q-separator>
        <q-card-section>
          <q-input
            type="textarea"
            autogrow
            readonly
            :model-value="caddySample"
          ></q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup></q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style>
.webpages-editor-page .q-splitter__before,
.webpages-editor-page .q-splitter__after {
  height: 100%;
}

.webpages-editor-page .code-editor-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
  border: 1px solid #26364d;
  border-radius: 8px;
  background: #0a1220;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.webpages-editor-page .code-layer,
.webpages-editor-page .code-input {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 12px;
  font-family: 'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre;
  overflow: auto;
}

.webpages-editor-page .code-layer {
  pointer-events: none;
  color: #d7e0ef;
}

.webpages-editor-page .code-input {
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: #e6f0ff;
  text-shadow: 0 0 0 transparent;
}

.webpages-editor-page .tok-comment {
  color: #6f8faf;
  font-style: italic;
}

.webpages-editor-page .tok-string {
  color: #67e8f9;
}

.webpages-editor-page .tok-keyword {
  color: #c084fc;
  font-weight: 600;
}

.webpages-editor-page .tok-number {
  color: #fca5a5;
}

.webpages-editor-page .tok-tag {
  color: #60a5fa;
}

.webpages-editor-page .code-editor-wrap:focus-within {
  border-color: #4ea1ff;
  box-shadow:
    0 0 0 1px rgba(78, 161, 255, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
</style>
