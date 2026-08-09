const adminsEl = document.getElementById("admins");
const rosterEl = document.getElementById("roster");
const topRatedEl = document.getElementById("top-rated");

let admins = [];
let reviews = [];
let focusAdminId = null;
let selectedRatingByAdmin = {};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function starsText(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function reviewsFor(adminId) {
  return reviews.filter((r) => r.adminId === adminId);
}

function paintStars(root, value) {
  root.querySelectorAll(".star-btn").forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.value) <= value);
  });
}

function goToAdmin(adminId) {
  focusAdminId = adminId;
  renderAdmins();
  const target = document.getElementById(`admin-${adminId}`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("flash");
    setTimeout(() => target.classList.remove("flash"), 1200);
  }
}

function renderTopRated() {
  if (!topRatedEl) return;

  const top3 = admins.filter((a) => a.reviewCount > 0).slice(0, 3);

  if (!top3.length) {
    topRatedEl.innerHTML = `<p class="top-empty">ما فيه تقييمات بعد — كن أول من يقيّم.</p>`;
    return;
  }

  topRatedEl.innerHTML = top3
    .map((admin, index) => {
      const rank = index + 1;
      const avg = admin.averageRating.toFixed(1);
      return `
        <button type="button" class="top-card rank-${rank}" data-id="${escapeHtml(admin.id)}">
          <span class="top-rank">#${rank}</span>
          <img class="top-avatar" src="${escapeHtml(admin.avatar || "")}?v=5" alt="" width="72" height="72" loading="lazy" />
          <span class="top-name">${escapeHtml(admin.name)}</span>
          <span class="top-stars">${starsText(admin.averageRating)}</span>
          <span class="top-meta">${escapeHtml(avg)} · ${admin.reviewCount} رأي</span>
        </button>
      `;
    })
    .join("");

  topRatedEl.querySelectorAll(".top-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.id) goToAdmin(card.dataset.id);
    });
  });
}

function renderRoster() {
  if (!rosterEl) return;

  const topIds = new Set(
    admins.filter((a) => a.reviewCount > 0).slice(0, 3).map((a) => a.id)
  );
  const rest = admins.filter((a) => !topIds.has(a.id));

  if (!rest.length) {
    rosterEl.innerHTML = "";
    return;
  }

  rosterEl.innerHTML = rest
    .map(
      (admin) => `
      <button type="button" class="roster-chip" data-id="${escapeHtml(admin.id)}">
        <img class="roster-avatar" src="${escapeHtml(admin.avatar || "")}?v=5" alt="" width="54" height="54" loading="lazy" />
        <span class="roster-name">${escapeHtml(admin.name)}</span>
        <span class="roster-stars">${
          admin.reviewCount > 0 ? starsText(admin.averageRating) : "بدون تقييم"
        }</span>
      </button>
    `
    )
    .join("");

  rosterEl.querySelectorAll(".roster-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (chip.dataset.id) goToAdmin(chip.dataset.id);
    });
  });
}

function renderReviewsHtml(adminId) {
  const list = reviewsFor(adminId);
  if (!list.length) {
    return `<p class="empty">ما فيه آراء بعد — كن أول من يكتب.</p>`;
  }

  return `
    <div class="reviews">
      ${list
        .map(
          (review) => `
        <article class="review">
          <div class="review-top">
            <span class="review-author">${escapeHtml(review.author)}</span>
            <span class="review-stars">${starsText(review.rating)}</span>
          </div>
          <p class="review-text">${escapeHtml(review.text)}</p>
          <time class="review-date" datetime="${escapeHtml(review.createdAt)}">
            ${escapeHtml(formatDate(review.createdAt))}
          </time>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

function renderAdmins() {
  if (!admins.length) {
    adminsEl.innerHTML = `<p class="empty">ما فيه أدمنية حالياً.</p>`;
    return;
  }

  adminsEl.innerHTML = admins
    .map((admin) => {
      const avg = admin.reviewCount > 0 ? admin.averageRating.toFixed(1) : "—";
      const countLabel =
        admin.reviewCount > 0 ? `${admin.reviewCount} رأي` : "بدون آراء";
      const focused = focusAdminId === admin.id ? "focused" : "";
      const currentRating = selectedRatingByAdmin[admin.id] || 0;

      return `
        <article class="profile ${focused}" id="admin-${escapeHtml(admin.id)}" data-id="${escapeHtml(admin.id)}">
          <header class="profile-head">
            <img class="admin-avatar" src="${escapeHtml(admin.avatar || "")}?v=5" alt="${escapeHtml(admin.name)}" width="68" height="68" loading="lazy" />
            <div class="admin-copy">
              <h3 class="admin-name">${escapeHtml(admin.name)}</h3>
              <p class="admin-role">${escapeHtml(admin.role || "مشرف")}</p>
            </div>
            <div class="admin-score">
              <strong>${escapeHtml(String(avg))} ★</strong>
              <small>${escapeHtml(countLabel)}</small>
            </div>
          </header>

          <div class="reviews-box">
            <h4 class="box-title">الآراء</h4>
            ${renderReviewsHtml(admin.id)}
          </div>

          <div class="compose-box">
            <h4 class="box-title">اكتب رأيك</h4>
            <form class="compose" data-admin="${escapeHtml(admin.id)}" novalidate>
              <div class="compose-row">
                <label class="field grow">
                  <span>اسمك <small>(اختياري)</small></span>
                  <input name="author" type="text" maxlength="80" placeholder="زائر تلقائي" autocomplete="nickname" />
                </label>
                <div class="field">
                  <span>النجوم <small>(مطلوب)</small></span>
                  <div class="stars" role="radiogroup" aria-label="التقييم بالنجوم">
                    ${[1, 2, 3, 4, 5]
                      .map(
                        (n) =>
                          `<button type="button" class="star-btn ${n <= currentRating ? "on" : ""}" data-value="${n}" aria-label="${n} نجوم">★</button>`
                      )
                      .join("")}
                  </div>
                  <input type="hidden" name="rating" value="${currentRating || ""}" />
                </div>
              </div>
              <label class="field">
                <span>رأيك</span>
                <textarea name="text" maxlength="5000" placeholder="اكتب أي شيء... حتى حرف واحد" required></textarea>
              </label>
              <div class="compose-actions">
                <p class="msg" role="status" aria-live="polite"></p>
                <button type="submit" class="submit">نشر</button>
              </div>
            </form>
          </div>
        </article>
      `;
    })
    .join("");

  bindAdminUi();
}

function bindAdminUi() {
  adminsEl.querySelectorAll("form.compose").forEach((form) => {
    const adminId = form.dataset.admin;
    const ratingInput = form.querySelector('input[name="rating"]');
    const msgEl = form.querySelector(".msg");
    const current = selectedRatingByAdmin[adminId] || 0;
    paintStars(form, current);

    form.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = Number(btn.dataset.value);
        selectedRatingByAdmin[adminId] = value;
        ratingInput.value = String(value);
        paintStars(form, value);
        msgEl.textContent = "";
        msgEl.className = "msg";
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      msgEl.textContent = "";
      msgEl.className = "msg";

      const rating = Number(ratingInput.value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        msgEl.textContent = "لازم تختار تقييم بالنجوم";
        msgEl.className = "msg error";
        return;
      }

      const text = form.text.value.trim();
      if (!text) {
        msgEl.textContent = "اكتب رأيك (حتى حرف واحد يكفي)";
        msgEl.className = "msg error";
        return;
      }

      const author = form.author.value.trim() || "زائر تلقائي";
      const submitBtn = form.querySelector(".submit");
      const payload = { adminId, author, text, rating };

      submitBtn.disabled = true;
      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          msgEl.textContent = data.error || "ما قدرنا ننشر الرأي";
          msgEl.className = "msg error";
          return;
        }

        focusAdminId = adminId;
        selectedRatingByAdmin[adminId] = 0;
        await refresh();
      } catch {
        msgEl.textContent = "صار خطأ بالشبكة، جرّب مرة ثانية";
        msgEl.className = "msg error";
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
}

async function refresh() {
  const [adminsRes, reviewsRes] = await Promise.all([
    fetch("/api/admins"),
    fetch("/api/reviews"),
  ]);

  if (!adminsRes.ok || !reviewsRes.ok) throw new Error("load failed");

  admins = await adminsRes.json();
  reviews = await reviewsRes.json();
  renderTopRated();
  renderRoster();
  renderAdmins();
}

refresh().catch(() => {
  adminsEl.innerHTML = `<p class="empty">تعذر الاتصال بالسيرفر.</p>`;
});
