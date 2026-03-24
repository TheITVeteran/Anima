<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { DEFAULT_AVATAR_VOICE_ID, useAppState } from "../stores/appState";
import {
  audioLanguageList,
  avatarsDelete,
  avatarsLookUpload,
  avatarsUpdate,
  preGeneration,
  ttsUpdate,
  validateImage,
} from "../api/avatars";
import { fetchOpenClawAgents, createOpenClawAgent, syncOpenClawAgents } from "../api/chat";
import type { OpenClawAgent } from "../api/chat";
import { translate } from "../locales";
import { modelGenerate } from "../api/model";

const router = useRouter();
const { createAvatarTask } = useAppState();

const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref("");
const avatarName = ref("My Avatar");
const avatarsId = ref("");
const uploadedImage = ref("");
const validationPassed = ref(false);
const customStyleApplied = ref(false);
const defaultVoiceApplied = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const showLeaveConfirm = ref(false);
const leaveErrorMessage = ref("");
const deletingDraft = ref(false);
const leaveBlockedByLoading = ref(false);
const pendingLeavePath = ref("/avatars");
const hasSubmittedGeneration = ref(false);
const bypassLeaveGuard = ref(false);

const currentStep = ref(1);
const step = computed(() => {
  if (currentStep.value === 3) return 3;
  return fileName.value ? 2 : 1;
});
const isPhotoProcessing = computed(() => loading.value && !validationPassed.value);

const agentTab = ref<"create" | "existing">("create");
const agentId = ref("");
const agentNameInput = ref("");
const agentPersona = ref("");
const agentPrompt = ref("");
const selectedExistingAgentIdx = ref(-1);

type ExistingAgent = { id: string; name: string; desc: string; type: string };
const existingAgents = ref<ExistingAgent[]>([]);
const agentsLoading = ref(false);

const mapAgents = (agents: OpenClawAgent[]) =>
  agents.map((a) => ({
    id: a.id,
    name: a.name || a.id,
    desc: a.owned_by || "OpenClaw Agent",
    type: a.id === a.name || !a.name ? "Default" : "Custom",
  }));

const loadOpenClawAgents = async () => {
  agentsLoading.value = true;
  try {
    existingAgents.value = mapAgents(await fetchOpenClawAgents());
  } catch {
    existingAgents.value = [];
  } finally {
    agentsLoading.value = false;
  }
};

const syncAndLoadAgents = async () => {
  agentsLoading.value = true;
  try {
    existingAgents.value = mapAgents(await syncOpenClawAgents());
  } catch {
    existingAgents.value = [];
  } finally {
    agentsLoading.value = false;
  }
};

const goToAgentStep = () => {
  currentStep.value = 3;
  if (!existingAgents.value.length && !agentsLoading.value) {
    loadOpenClawAgents();
  }
};

onMounted(() => {
  loadOpenClawAgents();
});

const backToNameStep = () => {
  currentStep.value = 2;
};

const selectExistingAgent = (idx: number) => {
  selectedExistingAgentIdx.value = idx;
};
const hasUnsubmittedDraft = computed(() => Boolean(avatarsId.value) && !hasSubmittedGeneration.value);

const isSuccessCode = (code?: number) => code === 200 || code === 0;

const ensureAvatarId = async () => {
  if (!avatarsId.value) {
    // Follow ppt-talk standard creation path first.
    const res = await preGeneration({ nickname: avatarName.value.trim() || "untitled" });
    if (!isSuccessCode(res?.code) || !res?.data) {
      errorMessage.value = res?.msg || translate("create.errorCreateTask");
      return false;
    }
    avatarsId.value = String(res.data);
  }

  if (!customStyleApplied.value) {
    // Mark this avatar as custom-style under standard flow.
    const updateRes = await avatarsUpdate({
      avatarsId: avatarsId.value,
      selectTemplateImg: "custom-style",
    });
    if (!isSuccessCode(updateRes?.code)) {
      errorMessage.value = updateRes?.msg || translate("create.errorStyleSet");
      return false;
    }
    customStyleApplied.value = true;
  }

  if (!defaultVoiceApplied.value) {
    try {
      const languagesRes = await audioLanguageList();
      if (isSuccessCode(languagesRes?.code)) {
        const languages = Array.isArray(languagesRes?.data) ? languagesRes.data : [];
        const preferred =
          languages.find((item) => String(item?.code || "").toLowerCase().includes("zh")) || languages[0];
        const languageId = preferred?.id;
        if (languageId !== undefined && languageId !== null && String(languageId).trim()) {
          const payload: {
            avatarsId: string;
            languageId: string | number;
            action: "add";
            ttsId?: string | number;
          } = {
            avatarsId: avatarsId.value,
            languageId,
            action: "add",
          };
          const defaultVoiceId = preferred?.defaultVoiceId;
          if (defaultVoiceId !== undefined && defaultVoiceId !== null && String(defaultVoiceId).trim()) {
            payload.ttsId = defaultVoiceId;
          }
          await ttsUpdate(payload);
        }
      }
    } catch {
      // Do not block create flow if default voice binding fails.
    } finally {
      defaultVoiceApplied.value = true;
    }
  }

  return true;
};

const chooseFile = () => {
  if (loading.value) return;
  fileInputRef.value?.click();
};

const validateLocalFile = (file: File) => {
  const isImage = file.type === "image/jpeg" || file.type === "image/png";
  if (!isImage) {
    errorMessage.value = translate("create.errorOnlyJpgPng");
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    errorMessage.value = translate("create.errorMaxSize");
    return false;
  }
  return true;
};

const uploadAndValidate = async (file: File) => {
  errorMessage.value = "";
  validationPassed.value = false;
  loading.value = true;
  try {
    const ok = await ensureAvatarId();
    if (!ok) return;

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("avatarsId", avatarsId.value);
    const uploadRes = await avatarsLookUpload(uploadForm);
    if (!isSuccessCode(uploadRes?.code) || !uploadRes?.data) {
      errorMessage.value = uploadRes?.msg || translate("create.errorUpload");
      return;
    }

    uploadedImage.value = String(uploadRes.data);
    fileName.value = file.name;

    const verifyForm = new FormData();
    verifyForm.append("file", file, file.name);
    const verifyRes = await validateImage(verifyForm);
    if (!isSuccessCode(verifyRes?.code) || !verifyRes?.data) {
      errorMessage.value = verifyRes?.msg || translate("create.errorValidate");
      return;
    }
    validationPassed.value = true;
  } catch {
    errorMessage.value = translate("create.errorNetwork");
  } finally {
    loading.value = false;
  }
};

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!validateLocalFile(file)) return;
  await uploadAndValidate(file);
  target.value = "";
};

const resetUpload = () => {
  fileName.value = "";
  uploadedImage.value = "";
  validationPassed.value = false;
  errorMessage.value = "";
  defaultVoiceApplied.value = false;
  currentStep.value = 1;
};

const closeLeaveConfirm = () => {
  if (deletingDraft.value) return;
  showLeaveConfirm.value = false;
  leaveBlockedByLoading.value = false;
  leaveErrorMessage.value = "";
  pendingLeavePath.value = "/avatars";
};

const navigateWithoutGuard = (path: string) => {
  bypassLeaveGuard.value = true;
  router.push(path);
};

const deleteDraftAvatar = async () => {
  if (!hasUnsubmittedDraft.value) return true;
  deletingDraft.value = true;
  leaveErrorMessage.value = "";
  try {
    const res = await avatarsDelete(avatarsId.value);
    if (!isSuccessCode(res?.code)) {
      leaveErrorMessage.value = res?.msg || translate("create.errorDeleteDraft");
      return false;
    }
    avatarsId.value = "";
    resetUpload();
    return true;
  } catch {
    leaveErrorMessage.value = translate("create.errorDeleteDraft");
    return false;
  } finally {
    deletingDraft.value = false;
  }
};

const requestLeave = (path = "/avatars") => {
  if (loading.value) {
    leaveBlockedByLoading.value = true;
    leaveErrorMessage.value = "";
    showLeaveConfirm.value = true;
    return;
  }
  if (!hasUnsubmittedDraft.value) {
    navigateWithoutGuard(path);
    return;
  }
  leaveBlockedByLoading.value = false;
  pendingLeavePath.value = path;
  leaveErrorMessage.value = "";
  showLeaveConfirm.value = true;
};

const confirmLeaveAndDelete = async () => {
  const ok = await deleteDraftAvatar();
  if (!ok) return;
  const nextPath = pendingLeavePath.value || "/avatars";
  closeLeaveConfirm();
  navigateWithoutGuard(nextPath);
};

const submit = async () => {
  if (!uploadedImage.value || !avatarsId.value || !validationPassed.value) {
    errorMessage.value = translate("create.errorNeedUpload");
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    const formData = new FormData();
    formData.append("url", uploadedImage.value);
    formData.append("avatarsId", avatarsId.value);
    formData.append("modelType", "0");
    formData.append("sex", "0");
    formData.append("video", "0");
    const res = await modelGenerate(formData);
    if (!isSuccessCode(res?.code)) {
      errorMessage.value = res?.msg || translate("create.errorSubmitGenerate");
      return;
    }
    hasSubmittedGeneration.value = true;

    let resolvedAgentId: string | undefined;
    if (agentTab.value === "existing" && selectedExistingAgentIdx.value >= 0) {
      resolvedAgentId = existingAgents.value[selectedExistingAgentIdx.value]?.id;
    } else if (agentTab.value === "create" && agentId.value.trim()) {
      const createRes = await createOpenClawAgent({
        id: agentId.value.trim(),
        identityName: agentNameInput.value.trim() || undefined,
        identityEmoji: undefined,
        persona: agentPersona.value.trim() || undefined,
        systemPrompt: agentPrompt.value.trim() || undefined,
      });
      if (createRes.code === 200) {
        resolvedAgentId = agentId.value.trim();
        console.log("[Agent] created:", createRes.data?.steps);
      } else {
        console.warn("[Agent] creation failed:", createRes.msg);
        resolvedAgentId = agentId.value.trim();
      }
    }

    createAvatarTask(avatarName.value.trim() || "My Avatar", {
      id: avatarsId.value,
      image: uploadedImage.value || "/sumi.png",
      voiceId: DEFAULT_AVATAR_VOICE_ID,
      mockProgress: false,
      agentId: resolvedAgentId,
    });
    router.push({
      path: "/avatars",
      query: { refresh: `${Date.now()}` },
    });
  } catch {
    errorMessage.value = translate("create.errorGenerateRequest");
  } finally {
    loading.value = false;
  }
};

onBeforeRouteLeave((to) => {
  if (bypassLeaveGuard.value) {
    bypassLeaveGuard.value = false;
    return true;
  }
  if (loading.value) {
    leaveBlockedByLoading.value = true;
    leaveErrorMessage.value = "";
    showLeaveConfirm.value = true;
    return false;
  }
  if (!hasUnsubmittedDraft.value) return true;
  leaveBlockedByLoading.value = false;
  pendingLeavePath.value = to.fullPath || "/avatars";
  leaveErrorMessage.value = "";
  showLeaveConfirm.value = true;
  return false;
});
</script>

<template>
  <section class="page create-page">
    <div class="create-nav">
      <button class="back-btn" :disabled="loading" @click="requestLeave('/avatars')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {{ translate("create.back") }}
      </button>
    </div>

    <div class="create-main">
      <h1 class="create-title">{{ translate("create.title") }}</h1>
      <p class="create-subtitle">{{ translate("create.subtitle") }}</p>

      <div class="steps">
        <div class="step" :class="{ active: step >= 1, done: step > 1 }">
          <div class="step-num">1</div>
          <span class="step-label">{{ translate("create.stepUpload") }}</span>
          <div class="step-line"></div>
        </div>
        <div class="step" :class="{ active: step >= 2, done: step > 2 }">
          <div class="step-num">2</div>
          <span class="step-label">{{ translate("create.stepName") }}</span>
          <div class="step-line"></div>
        </div>
        <div class="step" :class="{ active: step >= 3 }">
          <div class="step-num">3</div>
          <span class="step-label">{{ translate("create.stepAgent") }}</span>
        </div>
      </div>

      <div v-if="!fileName">
        <div class="upload-zone" @click="chooseFile">
          <div class="upload-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div class="upload-text">{{ translate("create.dragDrop") }}</div>
          <div class="upload-hint">{{ translate("create.uploadHint") }}</div>
          <button class="upload-btn" type="button" @click.stop="chooseFile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {{ translate("create.chooseFile") }}
          </button>
          <div class="upload-specs">
            <div class="spec-item"><div class="spec-dot"></div>768 × 1024 px</div>
            <div class="spec-item"><div class="spec-dot"></div>JPG / PNG</div>
            <div class="spec-item"><div class="spec-dot"></div>&lt; 10MB</div>
          </div>
          <div v-if="isPhotoProcessing" class="upload-loading-mask">
            <div class="upload-loading-spinner"></div>
            <div class="upload-loading-text">{{ translate("create.uploadingAndChecking") }}</div>
          </div>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg"
          style="display:none"
          @change="onFileChange"
        />

        <div class="photo-requirements">
          <span class="req">{{ translate("create.reqFront") }}</span>
          <span class="req">{{ translate("create.reqClear") }}</span>
          <span class="req">{{ translate("create.reqLight") }}</span>
          <span class="req">{{ translate("create.reqSingle") }}</span>
          <span class="req bad">{{ translate("create.reqBad") }}</span>
        </div>
      </div>

      <!-- Step 2: Name -->
      <div v-else-if="step === 2" class="upload-preview-state visible">
        <div class="uploaded-image-wrap">
          <img :src="uploadedImage || '/sumi.png'" alt="Preview" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;display:block;" />
          <div class="uploaded-overlay">
            <div class="uploaded-info">{{ fileName }} · 768 × 1024 · 2.4 MB</div>
          </div>
          <button class="re-upload-btn" :disabled="loading" @click="resetUpload">{{ translate("create.reupload") }}</button>
          <div v-if="isPhotoProcessing" class="upload-loading-mask">
            <div class="upload-loading-spinner"></div>
            <div class="upload-loading-text">{{ translate("create.checkingImage") }}</div>
          </div>
        </div>
        <p class="login-hint" :style="{ marginTop: '0', color: validationPassed ? '#34d399' : '#707070', textAlign: 'left' }">
          {{ validationPassed ? translate("create.photoValidated") : translate("create.photoValidating") }}
        </p>

        <div class="form-group create-name-group">
          <label class="form-label">{{ translate("create.avatarName") }}</label>
          <input v-model="avatarName" class="char-name-input" type="text" :placeholder="translate('create.avatarNamePlaceholder')" />
        </div>

        <button class="generate-btn" type="button" :disabled="loading || !validationPassed" @click="goToAgentStep">
          {{ translate("create.nextStepAgent") }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>

      <!-- Step 3: Link Agent -->
      <div v-else-if="step === 3" class="upload-preview-state visible">
        <div class="agent-setup-section">
          <div class="agent-setup-toggle">
            <button class="agent-toggle-btn" :class="{ active: agentTab === 'create' }" @click="agentTab = 'create'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {{ translate("create.agentTabCreate") }}
            </button>
            <button class="agent-toggle-btn" :class="{ active: agentTab === 'existing' }" @click="agentTab = 'existing'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {{ translate("create.agentTabExisting") }}
            </button>
          </div>

          <!-- Create New Agent -->
          <div v-if="agentTab === 'create'" class="agent-tab-panel active">
            <div class="form-group">
              <label class="form-label">{{ translate("create.agentIdLabel") }}</label>
              <input v-model="agentId" class="char-name-input" type="text" :placeholder="translate('create.agentIdPlaceholder')" />
              <div class="field-hint">{{ translate("create.agentIdHint") }}</div>
            </div>

            <div class="form-group">
              <label class="form-label">{{ translate("create.agentNameLabel") }}</label>
              <input v-model="agentNameInput" class="char-name-input" type="text" :placeholder="translate('create.agentNamePlaceholder')" />
            </div>

            <div class="form-group">
              <label class="form-label">{{ translate("create.agentPersonaLabel") }}</label>
              <textarea v-model="agentPersona" class="agent-persona-input" :placeholder="translate('create.agentPersonaPlaceholder')"></textarea>
              <div class="field-hint">{{ translate("create.agentPersonaHint") }}</div>
            </div>

            <div class="form-group">
              <label class="form-label">
                {{ translate("create.agentPromptLabel") }}
                <span style="color:var(--text-muted);font-weight:400;">{{ translate("create.agentPromptOptional") }}</span>
              </label>
              <textarea v-model="agentPrompt" class="agent-persona-input agent-prompt-input" :placeholder="translate('create.agentPromptPlaceholder')"></textarea>
            </div>

            <button class="generate-btn" type="button" :disabled="loading" @click="submit">
              {{ loading ? translate("create.submitting") : translate("create.submit") }}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>

          <!-- Use Existing Agent -->
          <div v-else class="agent-tab-panel active">
            <div class="existing-agent-hint">{{ translate("create.existingAgentHint") }}</div>
            <div v-if="agentsLoading" class="existing-agent-loading">
              <div class="upload-loading-spinner" style="width:20px;height:20px;border-width:2px;"></div>
              <span>{{ translate("common.loading") }}</span>
            </div>
            <div v-else-if="!existingAgents.length" class="existing-agent-empty">
              {{ translate("create.noAgentsFound") }}
            </div>
            <div v-else class="existing-agent-list">
              <div
                v-for="(agent, idx) in existingAgents"
                :key="agent.id"
                class="existing-agent-item"
                :class="{ selected: selectedExistingAgentIdx === idx }"
                @click="selectExistingAgent(idx)"
              >
                <div class="ea-radio"></div>
                <div class="ea-info">
                  <div class="ea-name">
                    {{ agent.name }}
                    <span class="ea-tag" :class="agent.type.toLowerCase()">{{ agent.type }}</span>
                  </div>
                  <div class="ea-id">agent-id: {{ agent.id }}</div>
                  <div class="ea-desc">{{ agent.desc }}</div>
                </div>
              </div>
            </div>
            <button class="existing-agent-sync" type="button" :disabled="agentsLoading" @click="syncAndLoadAgents">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3"/><path d="M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              {{ agentsLoading ? translate("common.loading") : translate("create.existingAgentSynced") }}
            </button>
            <button
              class="generate-btn"
              type="button"
              :disabled="loading || selectedExistingAgentIdx < 0"
              :style="selectedExistingAgentIdx < 0 ? { opacity: '0.5', pointerEvents: 'none' } : {}"
              @click="submit"
            >
              {{ loading ? translate("create.submitting") : translate("create.submit") }}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        <button class="back-step-btn" type="button" @click="backToNameStep">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
          {{ translate("create.stepName") }}
        </button>
      </div>
      <p v-if="errorMessage" class="login-hint" style="margin-top:12px;color:#ef4444;text-align:left">{{ errorMessage }}</p>
    </div>

    <div class="confirm-overlay" :class="{ open: showLeaveConfirm }" @click="closeLeaveConfirm">
      <div class="confirm-card" @click.stop>
        <h3>{{ leaveBlockedByLoading ? translate("create.leaveBusyTitle") : translate("create.leaveTitle") }}</h3>
        <p v-if="leaveBlockedByLoading">{{ translate("create.leaveBusyDesc") }}</p>
        <p v-else>{{ translate("create.leaveDesc") }}</p>
        <p v-if="leaveErrorMessage" class="confirm-error">{{ leaveErrorMessage }}</p>
        <div class="confirm-actions">
          <button class="confirm-cancel-btn" :disabled="deletingDraft" @click="closeLeaveConfirm">
            {{ leaveBlockedByLoading ? translate("create.leaveBusyAck") : translate("create.leaveContinue") }}
          </button>
          <button v-if="!leaveBlockedByLoading" class="confirm-danger-btn" :disabled="deletingDraft" @click="confirmLeaveAndDelete">
            {{ deletingDraft ? translate("common.processing") : translate("create.leaveConfirm") }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
