"use client";

import { useEffect, useState } from "react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";

export default function GoldCommunityPage() {
  const { t } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const goldRequired = t.goldRequired;
  const [state, setState] = useState({ loading: true, error: "", community: null });

  useEffect(() => {
    fetch("/api/community/gold")
      .then(async (response) => {
        const data = await response.json();
        setState({
          loading: false,
          error: response.ok
            ? ""
            : response.status === 403
              ? goldRequired
              : translateServerMessage(response.status, { requestFailed, serverError }),
          community: response.ok ? data : null,
        });
      })
      .catch(() => setState({ loading: false, error: networkError, community: null }));
  }, [goldRequired, networkError, requestFailed, serverError]);

  if (state.loading) return <p role="status">{t.loadingExclusiveCommunity}</p>;
  if (state.error) return <p role="alert">{state.error}</p>;
  return (
    <section className="page-enter mx-auto max-w-[900px]">
      <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">{t.exclusiveCommunityLabel}</p>
      <h1 className="mt-2 text-[29px] font-semibold">{t.exclusiveCommunityTitle}</h1>
      <p className="mt-2 text-[12px] text-[#8c938b]">{t.exclusiveCommunityDescription}</p>
      {!state.community.posts.length && <p className="mt-8 text-[12px] text-[#8c938b]">{t.noCommunityPosts}</p>}
    </section>
  );
}