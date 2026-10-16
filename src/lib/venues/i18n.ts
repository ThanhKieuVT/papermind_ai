"use client";

import { useEffect, useState } from "react";
import type { AreaCode } from "@/lib/venues/types";
import type { MilestoneKind, SortKey, StatusFilter, Urgency } from "@/lib/venues/schedule";
import type { Region } from "@/lib/venues/location";

export type Lang = "en" | "vi";
const LANG_KEY = "papermind:venues-lang";

export const VENUE_TEXT = {
  en: {
    locale: "en-GB",
    title: "Venues & Deadlines",
    description: "Submission deadlines, rankings (CORE, CCF, THCPL) and acceptance rates for computer-science conferences. Times are converted from each venue's published timezone.",
    exportShown: "Export shown to calendar",
    search: "Search",
    searchPlaceholder: "Acronym, full name, city… e.g. NeurIPS, vision, Vienna",
    showTimesIn: "Show times in",
    sortBy: "Sort by",
    sort: { deadline: "Next deadline", event: "Conference date", accept: "Most selective", name: "Name (A–Z)" } satisfies Record<SortKey, string>,
    status: { upcoming: "Open now", "30d": "Next 30 days", tba: "Not announced", followed: "★ Following", all: "All venues" } satisfies Record<StatusFilter, string>,
    statusGroup: "Deadline status",
    researchArea: "Research area",
    ranking: "Ranking (any match)",
    rankingHint: "A venue matches if it has any of the selected ranks",
    hostRegion: "Where it's held",
    country: "Country",
    allCountries: "All countries",
    regions: {
      asia: "Asia", europe: "Europe", "north-america": "North America", "south-america": "South America",
      oceania: "Oceania", africa: "Africa", online: "Online only",
    } satisfies Record<Region, string>,
    areas: {
      AI: "Artificial Intelligence", CG: "Graphics & Multimedia", CT: "Theory", DB: "Databases & Data Mining",
      DS: "Architecture & Systems", HI: "HCI & Ubiquitous Computing", MX: "Interdisciplinary & Emerging",
      NW: "Networking", SC: "Security & Privacy", SE: "Software Engineering",
    } satisfies Record<AreaCode, string>,
    count: (n: number, total: number) => `${n} of ${total} venues`,
    dueSoon: (n: number) => `${n} due within 7 days`,
    clearFilters: (n: number) => `Clear ${n} filter${n > 1 ? "s" : ""}`,
    urgency: { week: "Due within 7 days", month: "Due within 30 days", later: "Later", tba: "Not announced yet" } satisfies Record<Urgency, string>,
    noFollowsTitle: "You aren't following any venues yet",
    noFollowsBody: "Tap “Follow” on any venue to keep its deadlines here.",
    noMatchTitle: "No venues match",
    noMatchBody: "Try fewer filters or a different search.",
    showMore: (n: number) => `Show ${n} more`,
    filters: "Filters",
    showResults: (n: number) => `Show ${n} results`,
    view: { cards: "Cards", compact: "Compact" },
    viewLabel: "Layout",
    language: "Language",
    footer: (date: string) =>
      `a community-maintained dataset, last updated ${date}. Estimates for unannounced deadlines are based on previous editions and are not official. Always confirm dates on the official call for papers.`,
    dataLabel: "Data:",
    milestone: { abstract: "Abstract deadline", paper: "Paper deadline", rebuttal: "Rebuttal", notification: "Notification" } satisfies Record<MilestoneKind, string>,
    round: (i: number, n: number) => `Round ${i}/${n}`,
    nextDeadline: "Next deadline",
    notAnnounced: "Not announced yet",
    usuallyAround: (date: string, years: string) => `Usually around ${date} (based on ${years})`,
    estimateHint: "Estimated from the dates of recent editions. Not an official date.",
    noPattern: "No stable pattern in recent years",
    stale: (year: number) => `No edition listed since ${year}: the venue may have merged or stopped.`,
    tzUnclear: (tz: string) => `Timezone “${tz}” unclear: check the CFP.`,
    follow: "Follow",
    following: "Following",
    downloadIcs: (name: string) => `Download calendar file for ${name}`,
    officialCfp: "Official CFP",
    details: "Details",
    acceptance: "Acceptance",
    acceptedOf: (a: number, s: number) => `${a} accepted of ${s} submitted`,
    unranked: "Unranked",
    unrankedHint: "Not ranked by CCF, CORE or THCPL in the source data",
    timeLeft: "Time left",
    countdown: { d: "d", h: "h", m: "m", s: "s", passed: "Passed" },
    rankHelp: {
      ccf: "CCF (China Computer Federation) list — A: top international venues, B: important, C: recognised.",
      core: "CORE (Australia) — A*: flagship, A: excellent, B: good, C: meets minimum standards.",
      thcpl: "THCPL (Tsinghua University CS venue list) — A or B.",
    },
    table: { venue: "Venue", ranks: "Ranks", deadline: "Next deadline", left: "Time left", where: "Where" },
    detail: {
      area: "Area",
      dblp: "Past papers on DBLP",
      acceptance: "Acceptance rate",
      noAcceptance: "No acceptance-rate data in the source.",
      source: "source",
      byEdition: "Deadlines by edition",
      byEditionHint: "Times shown in your selected timezone. Each edition lists the timezone it was published in.",
      publishedIn: (tz: string) => `published in ${tz}`,
      noDeadlines: "No deadlines listed.",
      tba: "To be announced",
      footer: "Data from ccfddl/ccf-deadlines (community-maintained, MIT). Always confirm dates on the official call for papers.",
    },
    calendarNote: (tz: string) => `Published timezone: ${tz}. Always confirm on the official CFP.`,
  },
  vi: {
    locale: "vi-VN",
    title: "Hội nghị & Deadline",
    description: "Hạn nộp bài, xếp hạng (CORE, CCF, THCPL) và tỉ lệ chấp nhận của các hội nghị khoa học máy tính. Thời gian được quy đổi từ múi giờ mà mỗi hội nghị công bố.",
    exportShown: "Xuất lịch các mục đang hiển thị",
    search: "Tìm kiếm",
    searchPlaceholder: "Tên viết tắt, tên đầy đủ, thành phố… vd: NeurIPS, vision, Vienna",
    showTimesIn: "Hiển thị giờ theo",
    sortBy: "Sắp xếp",
    sort: { deadline: "Deadline gần nhất", event: "Ngày diễn ra", accept: "Khó nhất (tỉ lệ nhận thấp)", name: "Tên (A–Z)" } satisfies Record<SortKey, string>,
    status: { upcoming: "Đang nhận bài", "30d": "Trong 30 ngày tới", tba: "Chưa công bố", followed: "★ Đang theo dõi", all: "Tất cả" } satisfies Record<StatusFilter, string>,
    statusGroup: "Trạng thái deadline",
    researchArea: "Lĩnh vực",
    ranking: "Xếp hạng (khớp bất kỳ)",
    rankingHint: "Hội nghị được giữ lại nếu có ít nhất một hạng đã chọn",
    hostRegion: "Nơi tổ chức",
    country: "Quốc gia",
    allCountries: "Tất cả quốc gia",
    regions: {
      asia: "Châu Á", europe: "Châu Âu", "north-america": "Bắc Mỹ", "south-america": "Nam Mỹ",
      oceania: "Châu Đại Dương", africa: "Châu Phi", online: "Chỉ trực tuyến",
    } satisfies Record<Region, string>,
    areas: {
      AI: "Trí tuệ nhân tạo", CG: "Đồ hoạ & Đa phương tiện", CT: "Lý thuyết", DB: "Cơ sở dữ liệu & Khai phá dữ liệu",
      DS: "Kiến trúc & Hệ thống", HI: "Tương tác người–máy", MX: "Liên ngành & Mới nổi",
      NW: "Mạng máy tính", SC: "An ninh & Quyền riêng tư", SE: "Kỹ thuật phần mềm",
    } satisfies Record<AreaCode, string>,
    count: (n: number, total: number) => `${n} / ${total} hội nghị`,
    dueSoon: (n: number) => `${n} hạn trong 7 ngày`,
    clearFilters: (n: number) => `Xoá ${n} bộ lọc`,
    urgency: { week: "Hạn trong 7 ngày", month: "Hạn trong 30 ngày", later: "Sau đó", tba: "Chưa công bố" } satisfies Record<Urgency, string>,
    noFollowsTitle: "Bạn chưa theo dõi hội nghị nào",
    noFollowsBody: "Bấm “Theo dõi” ở một hội nghị để giữ deadline của nó tại đây.",
    noMatchTitle: "Không có hội nghị phù hợp",
    noMatchBody: "Thử bớt bộ lọc hoặc đổi từ khoá.",
    showMore: (n: number) => `Xem thêm ${n}`,
    filters: "Bộ lọc",
    showResults: (n: number) => `Xem ${n} kết quả`,
    view: { cards: "Thẻ", compact: "Gọn" },
    viewLabel: "Kiểu hiển thị",
    language: "Ngôn ngữ",
    footer: (date: string) =>
      `bộ dữ liệu do cộng đồng duy trì, cập nhật lần cuối ${date}. Mốc ước lượng cho hội nghị chưa công bố dựa trên các kỳ trước, không phải ngày chính thức. Luôn kiểm tra lại trên trang CFP chính thức.`,
    dataLabel: "Dữ liệu:",
    milestone: { abstract: "Hạn nộp abstract", paper: "Hạn nộp bài", rebuttal: "Phản hồi phản biện", notification: "Thông báo kết quả" } satisfies Record<MilestoneKind, string>,
    round: (i: number, n: number) => `Vòng ${i}/${n}`,
    nextDeadline: "Deadline tiếp theo",
    notAnnounced: "Chưa công bố",
    usuallyAround: (date: string, years: string) => `Thường vào khoảng ${date} (dựa trên ${years})`,
    estimateHint: "Ước lượng từ ngày của các kỳ gần đây. Không phải ngày chính thức.",
    noPattern: "Các năm gần đây không có quy luật ổn định",
    stale: (year: number) => `Không có kỳ nào từ ${year}: hội nghị có thể đã sáp nhập hoặc ngừng tổ chức.`,
    tzUnclear: (tz: string) => `Múi giờ “${tz}” không rõ: hãy kiểm tra trang CFP.`,
    follow: "Theo dõi",
    following: "Đang theo dõi",
    downloadIcs: (name: string) => `Tải file lịch của ${name}`,
    officialCfp: "Trang CFP chính thức",
    details: "Chi tiết",
    acceptance: "Tỉ lệ nhận",
    acceptedOf: (a: number, s: number) => `${a} bài được nhận / ${s} bài nộp`,
    unranked: "Chưa xếp hạng",
    unrankedHint: "Không có trong xếp hạng CCF, CORE hay THCPL của nguồn dữ liệu",
    timeLeft: "Thời gian còn lại",
    countdown: { d: " ngày ", h: "g ", m: "p", s: "s", passed: "Đã qua" },
    rankHelp: {
      ccf: "CCF (Hiệp hội Máy tính Trung Quốc) — A: hội nghị quốc tế hàng đầu, B: quan trọng, C: được công nhận.",
      core: "CORE (Úc) — A*: hàng đầu thế giới, A: xuất sắc, B: tốt, C: đạt chuẩn tối thiểu.",
      thcpl: "THCPL (danh sách hội nghị CNTT của ĐH Thanh Hoa) — hạng A hoặc B.",
    },
    table: { venue: "Hội nghị", ranks: "Xếp hạng", deadline: "Deadline tiếp theo", left: "Còn lại", where: "Địa điểm" },
    detail: {
      area: "Lĩnh vực",
      dblp: "Các bài đã đăng (DBLP)",
      acceptance: "Tỉ lệ chấp nhận",
      noAcceptance: "Nguồn dữ liệu không có tỉ lệ chấp nhận.",
      source: "nguồn",
      byEdition: "Deadline theo từng kỳ",
      byEditionHint: "Thời gian hiển thị theo múi giờ bạn chọn. Mỗi kỳ ghi kèm múi giờ công bố gốc.",
      publishedIn: (tz: string) => `công bố theo ${tz}`,
      noDeadlines: "Chưa có deadline.",
      tba: "Sẽ công bố sau",
      footer: "Dữ liệu từ ccfddl/ccf-deadlines (cộng đồng duy trì, giấy phép MIT). Luôn kiểm tra lại trên trang CFP chính thức.",
    },
    calendarNote: (tz: string) => `Múi giờ công bố: ${tz}. Luôn kiểm tra lại trên trang CFP chính thức.`,
  },
} as const;

export type VenueText = (typeof VENUE_TEXT)[Lang];

export const TIMEZONE_LABELS_VI: Record<string, string> = {
  local: "Giờ máy của tôi",
  "Asia/Ho_Chi_Minh": "Việt Nam (UTC+7)",
  "Etc/GMT+12": "Anywhere on Earth (AoE, UTC−12)",
  UTC: "UTC",
  "America/Los_Angeles": "Giờ Thái Bình Dương (Mỹ)",
  "America/New_York": "Giờ miền Đông (Mỹ)",
  "Europe/London": "London",
  "Europe/Berlin": "Trung Âu",
  "Asia/Shanghai": "Trung Quốc (UTC+8)",
  "Asia/Singapore": "Singapore",
  "Asia/Tokyo": "Nhật Bản / Hàn Quốc",
  "Australia/Sydney": "Sydney",
};

/** UI language for the Venues pages; remembered per browser, defaults to the browser language. */
export function useVenueLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "vi") setLang(saved);
      else if (navigator.language.toLowerCase().startsWith("vi")) setLang("vi");
    } catch {
      // ignore
    }
  }, []);
  const update = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // ignore
    }
  };
  return [lang, update];
}
