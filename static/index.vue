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

              <div class="q-pa-sm">
                <div class="row items-center q-gutter-sm q-mb-sm">
                  <div class="text-subtitle2">Images</div>
                  <q-space></q-space>
                  <input
                    ref="assetInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onAssetSelected"
                  />
                  <q-btn
                    dense
                    unelevated
                    color="primary"
                    size="sm"
                    icon="upload"
                    label="Upload"
                    :loading="uploadingAsset"
                    @click="openAssetPicker"
                  ></q-btn>
                </div>

                <q-list dense bordered separator>
                  <q-item v-for="image in filteredImages" :key="image.path">
                    <q-item-section>
                      <q-item-label>${ image.path }</q-item-label>
                      <q-item-label caption>
                        ${ formatSize(image.size) } · ${
                        formatDate(image.updated_at) }
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side class="row q-gutter-xs">
                      <q-btn
                        flat
                        dense
                        round
                        size="sm"
                        color="primary"
                        icon="content_copy"
                        @click="copyAssetUrl(image.path)"
                      ></q-btn>
                      <q-btn
                        flat
                        dense
                        round
                        size="sm"
                        color="negative"
                        icon="delete"
                        @click="confirmDeleteAsset(image.path)"
                      ></q-btn>
                    </q-item-section>
                  </q-item>

                  <q-item v-if="filteredImages.length === 0">
                    <q-item-section>
                      <q-item-label caption>No images found.</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
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
            <q-chip
              v-if="lastSavedAt"
              color="positive"
              text-color="white"
              dense
            >
              Saved ${ lastSavedAt }
            </q-chip>
            <q-space></q-space>
            <q-btn flat icon="refresh" @click="refreshAll"></q-btn>
            <q-btn flat icon="description" @click="openCaddyDialog">
              <q-tooltip
                >Caddyfile sample to serve over reverse_proxy</q-tooltip
              >
            </q-btn>
            <q-btn
              color="primary"
              label="Save"
              :disable="!currentPath"
              :loading="saving"
              @click="saveFile"
            ></q-btn>
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
                    <div ref="codeEditor" class="code-editor-host"></div>
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

.webpages-editor-page .code-editor-host {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.webpages-editor-page .code-editor-host .CodeMirror {
  height: 100%;
  background: transparent;
  color: #d7e0ef;
  font-family: 'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 14px;
  line-height: 1.65;
}

.webpages-editor-page .code-editor-host .CodeMirror-gutters {
  background: rgba(255, 255, 255, 0.02);
  border-right: 1px solid rgba(255, 255, 255, 0.07);
}

.webpages-editor-page .code-editor-host .CodeMirror-cursor {
  border-left: 1px solid #e6f0ff;
}

.webpages-editor-page .code-editor-host .CodeMirror-selected {
  background: rgba(30, 91, 191, 0.55) !important;
}

.webpages-editor-page .code-editor-host .cm-comment {
  color: #6f8faf;
  font-style: italic;
}

.webpages-editor-page .code-editor-host .cm-string {
  color: #67e8f9;
}

.webpages-editor-page .code-editor-host .cm-keyword,
.webpages-editor-page .code-editor-host .cm-tag {
  color: #60a5fa;
}

.webpages-editor-page .code-editor-host .cm-number {
  color: #fca5a5;
}

.webpages-editor-page .code-editor-wrap:focus-within {
  border-color: #4ea1ff;
  box-shadow:
    0 0 0 1px rgba(78, 161, 255, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
</style>
