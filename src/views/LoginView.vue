<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  getSavedAuthCredentials,
  isSuccessCode,
  login as loginApi,
  persistUserSession,
  register as registerApi,
  saveAuthCredentials,
} from "../api/user";
import { translate } from "../locales";
import { useAppState } from "../stores/appState";

const router = useRouter();
const { login } = useAppState();

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref("");

const buildNickname = (mailbox: string) => {
  const prefix = mailbox.split("@")[0]?.trim();
  return prefix || "Anima User";
};

const handleAuthSuccess = (mailbox: string, passwd: string, response: any) => {
  persistUserSession(response?.data);
  saveAuthCredentials({ mailbox, password: passwd });
  login(response?.data?.user?.mailbox || mailbox);
  router.push("/avatars");
};

const submit = async () => {
  const mailbox = email.value.trim();
  const passwd = password.value;
  if (!mailbox || !passwd) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    const loginResult = await loginApi({ mailbox, password: passwd });
    if (isSuccessCode(loginResult?.code)) {
      handleAuthSuccess(mailbox, passwd, loginResult);
      return;
    }

    const registerResult = await registerApi({
      nickname: buildNickname(mailbox),
      mailbox,
      password: passwd,
      invitationUserId: 0,
      productType: "3",
    });
    if (!isSuccessCode(registerResult?.code)) {
      errorMessage.value = registerResult?.msg || loginResult?.msg || translate("login.errorAuthFailed");
      return;
    }
    handleAuthSuccess(mailbox, passwd, registerResult);
  } catch {
    errorMessage.value = translate("login.errorRequestFailed");
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  const saved = getSavedAuthCredentials();
  if (!saved) return;
  email.value = saved.mailbox;
  password.value = saved.password;
  loading.value = true;
  errorMessage.value = "";
  try {
    const loginResult = await loginApi(saved);
    if (!isSuccessCode(loginResult?.code)) {
      errorMessage.value = translate("login.errorAutoLoginFailed");
      return;
    }
    handleAuthSuccess(saved.mailbox, saved.password, loginResult);
  } catch {
    errorMessage.value = translate("login.errorAutoLoginNetwork");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="page login-page">
    <div class="login-container">
      <div class="brand-section">
        <div class="brand-logo">
          <img src="/logo.png" alt="Anima" />
        </div>
        <h1 class="brand-name">Anima</h1>
        <p class="brand-sub">{{ translate("login.brandSub") }}</p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <div class="form-group">
          <label class="form-label">{{ translate("login.email") }}</label>
          <div class="form-input-wrap">
            <span class="icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input v-model="email" class="form-input" type="email" placeholder="your@email.com" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ translate("login.password") }}</label>
          <div class="form-input-wrap">
            <span class="icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              v-model="password"
              class="form-input"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="translate('login.passwordPlaceholder')"
              required
              style="padding-right:44px"
            />
            <button class="password-toggle" type="button" @click="showPassword = !showPassword">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <button class="login-btn" type="submit" :disabled="loading">
          {{ loading ? translate("login.submitting") : translate("login.submit") }}
        </button>
      </form>
      <p v-if="errorMessage" class="login-hint" style="margin-top:10px;color:#ef4444">{{ errorMessage }}</p>
      <p class="login-hint">{{ translate("login.hint") }}</p>
      <p class="login-terms">{{ translate("login.terms") }}</p>
    </div>
  </section>
</template>
