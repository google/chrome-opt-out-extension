// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <assert.h>
#include <atlbase.h>
#include <string>
#include <wininet.h>
#include "bho.h"
#include "nai_policy_registry.h"

namespace {
// Sets the opt out cookies.
void SetCookies() {
  for (size_t i = 0; i < kNaiPolicyRegistrySize; ++i) {
    // Include a P3P CP so the cookies aren't blocked by Internet Explorers
    // default settings. By default, third-party cookies that specify any P3P
    // CP will be accepted.
    BOOL success = InternetSetCookieEx(
        kNaiPolicyRegistry[i].url.c_str(),
        NULL,
        kNaiPolicyRegistry[i].cookie_data.c_str(),
        INTERNET_COOKIE_EVALUATE_P3P,
        (DWORD_PTR)(LPCSTR)"CP=\"This is not a P3P policy\"");
    assert(success);
  }
}
}  // namespace

// Implementation of IObjectWithSiteImpl::SetSite.
STDMETHODIMP KeepMyOptOutsBHO::SetSite(IUnknown* site) {
  if (site != NULL) {
    HRESULT hr = site->QueryInterface(IID_IWebBrowser2,
                                      reinterpret_cast<void **>(&web_browser_));
    if (SUCCEEDED(hr)) {
      hr = DispEventAdvise(web_browser_);
      advised_ = true;
    }
  } else {  // site == NULL
    if (advised_) {
      DispEventUnadvise(web_browser_);
      advised_ = false;
    }
    web_browser_.Release();
  }
  return IObjectWithSiteImpl<KeepMyOptOutsBHO>::SetSite(site);
}

// If enabled, refreshes the opt-out cookies before a page is loaded.
// This only applies to top-level documents (not to frames).
void STDMETHODCALLTYPE KeepMyOptOutsBHO::OnBeforeNavigate(
    IDispatch *dispatch,
    VARIANT *url,
    VARIANT *flags,
    VARIANT *target_frame_name,
    VARIANT *post_data,
    VARIANT *headers,
    VARIANT_BOOL *cancel) {
  if (web_browser_ != NULL && dispatch != NULL) {
    ATL::CComPtr<IUnknown> unknown1;
    ATL::CComPtr<IUnknown> unknown2;
    if (SUCCEEDED(web_browser_->QueryInterface(
                      IID_IUnknown, reinterpret_cast<void**>(&unknown1))) &&
        SUCCEEDED(dispatch->QueryInterface(
                      IID_IUnknown, reinterpret_cast<void**>(&unknown2)))) {
      if (unknown1 == unknown2) {
        SetCookies();
      }
    }
  }
}
