"use client";
import { useEffect, useState } from "react";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const KEY = "routiq_lang";
const arN = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n + " " + (n <= 10 ? few : many));

const EN = {
  welcome: "Welcome,",
  home: "Home",
  profile: "Profile",
  settings: "Settings",
  notLoggedIn: "You are not logged in.",
  login: "Log in",
  logout: "Log out",
  notFound:
    "Your client profile was not found. If you just signed up, try again in a moment. Otherwise contact your company.",
  tryAgain: "Try again",
  requestSent: "Request sent",
  pendingText:
    "The last step is for your company to approve your join request. You will be able to book trips once it is approved.",
  declined: "Your join request was declined. Please contact your company.",
  book: "Book trips",
  bookNote: "book your trip early, booking a trip closes at 9pm on the day before the trip",
  step1: "1. Pick your days",
  step2: "2. Join trips (one arrival and one return per day)",
  pickHint: "Pick a day to see its trips.",
  noTrips: "No trips available.",
  dayClosed: "Booking for this day is closed.",
  tripsWord: "trips",
  closedTom: "closed, opens again tomorrow",
  closedLater: "closed, opens again the day after tomorrow",
  closesIn: (h, m) =>
    "closes in " +
    [h ? h + " hour" + (h > 1 ? "s" : "") : "", m ? m + " minute" + (m > 1 ? "s" : "") : ""]
      .filter(Boolean)
      .join(" "),
  join: "Join",
  joined: "Joined",
  noTime: "No time set",
  ty: { arrival: "Arrival", return: "Return" },
  saving: "Saving...",
  saved: "Saved.",
  sure: "Are you sure?",
  yes: "Yes",
  cancel: "Cancel",
  ok: "OK",
  limitTitle: "Trip limit reached",
  unselect: (d, n) =>
    n
      ? `Unselect ${d}? This will also remove your ${n} trip${n > 1 ? "s" : ""} on that day.`
      : `Unselect ${d}?`,
  leave: (p, ty, d) => `Leave "${p} | ${ty}" on ${d}?`,
  limitNote: (ty, d) =>
    `You already joined a ${ty.toLowerCase()} trip on ${d}. Joining another one would exceed the limit of one arrival trip and one return trip per day. To switch, leave your current ${ty.toLowerCase()} trip first.`,
  changeTitle: "Your company wants to change your details",
  changeSub: "Nothing is changed until you agree. Please check each change:",
  agree: "Agree",
  decline: "Decline",
  daysNote: "Days you no longer have will also remove your trips on those days.",
  terms: "Terms and policy",
  f: {
    first_name: "First name",
    last_name: "Last name",
    phone: "Phone",
    parent_phone: "Parent phone",
    stop: "Stop",
    destination: "Destination",
    days: "Days",
  },
  days: {
    Sunday: "Sunday",
    Monday: "Monday",
    Tuesday: "Tuesday",
    Wednesday: "Wednesday",
    Thursday: "Thursday",
    Friday: "Friday",
    Saturday: "Saturday",
  },
  username: "Username",
  editProfile: "Edit profile",
  name: "Name",
  phoneNo: "Phone number",
  parentPhoneNo: "Parent phone number",
  save: "Save",
  nameReq: "Enter your first and last name.",
  phoneBad: "Enter a valid phone number.",
  parentBad: "Enter a valid parent phone number or leave it empty.",
  pickStop: "Pick your stop.",
  pickDest: "Pick your destination.",
  select: "Select",
  viewTerms: "View terms and policy",
  appearance: "Display style",
  language: "Language",
  account: "Account",
  themes: {
    dark: "Navy and cyan",
    gray: "White and gray",
    slate: "Black and gray",
    gold: "Black and gold",
    mono: "Basic white and black",
  },
};

const AR = {
  welcome: "\u0645\u0631\u062D\u0628\u0627\u060C",
  home: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
  profile: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A",
  settings: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A",
  notLoggedIn: "\u0644\u0645 \u062A\u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.",
  login: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
  logout: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C",
  notFound:
    "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0644\u0641\u0643. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644 \u0623\u0648 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0634\u0631\u0643\u062A\u0643.",
  tryAgain: "\u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649",
  requestSent: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628",
  pendingText:
    "\u0627\u0644\u062E\u0637\u0648\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629 \u0647\u064A \u0645\u0648\u0627\u0641\u0642\u0629 \u0634\u0631\u0643\u062A\u0643 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0627\u0646\u0636\u0645\u0627\u0645\u0643. \u0633\u062A\u062A\u0645\u0643\u0646 \u0645\u0646 \u062D\u062C\u0632 \u0627\u0644\u0631\u062D\u0644\u0627\u062A \u0628\u0639\u062F \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629.",
  declined:
    "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0646\u0636\u0645\u0627\u0645\u0643. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0634\u0631\u0643\u062A\u0643.",
  book: "\u062D\u062C\u0632 \u0627\u0644\u0631\u062D\u0644\u0627\u062A",
  bookNote:
    "\u0627\u062D\u062C\u0632 \u0631\u062D\u0644\u062A\u0643 \u0645\u0628\u0643\u0631\u0627\u060C \u064A\u063A\u0644\u0642 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0633\u0627\u0639\u0629 9 \u0645\u0633\u0627\u0621 \u0641\u064A \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0633\u0627\u0628\u0642 \u0644\u0644\u0631\u062D\u0644\u0629.",
  step1: "1. \u0627\u062E\u062A\u0631 \u0623\u064A\u0627\u0645\u0643",
  step2:
    "2. \u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0627\u0644\u0631\u062D\u0644\u0627\u062A (\u0631\u062D\u0644\u0629 \u0648\u0635\u0648\u0644 \u0648\u0623\u062E\u0631\u0649 \u0639\u0648\u062F\u0629 \u0644\u0643\u0644 \u064A\u0648\u0645)",
  pickHint: "\u0627\u062E\u062A\u0631 \u064A\u0648\u0645\u0627 \u0644\u0639\u0631\u0636 \u0631\u062D\u0644\u0627\u062A\u0647.",
  noTrips: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0631\u062D\u0644\u0627\u062A \u0645\u062A\u0627\u062D\u0629.",
  dayClosed: "\u0627\u0644\u062D\u062C\u0632 \u0644\u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645 \u0645\u063A\u0644\u0642.",
  tripsWord: "\u0631\u062D\u0644\u0627\u062A",
  closedTom: "\u0645\u063A\u0644\u0642\u060C \u064A\u0641\u062A\u062D \u0645\u062C\u062F\u062F\u0627 \u063A\u062F\u0627",
  closedLater: "\u0645\u063A\u0644\u0642\u060C \u064A\u0641\u062A\u062D \u0645\u062C\u062F\u062F\u0627 \u0628\u0639\u062F \u063A\u062F",
  closesIn: (h, m) =>
    "\u064A\u063A\u0644\u0642 \u062E\u0644\u0627\u0644 " +
    [
      h ? arN(h, "\u0633\u0627\u0639\u0629", "\u0633\u0627\u0639\u062A\u0627\u0646", "\u0633\u0627\u0639\u0627\u062A", "\u0633\u0627\u0639\u0629") : "",
      m ? arN(m, "\u062F\u0642\u064A\u0642\u0629", "\u062F\u0642\u064A\u0642\u062A\u0627\u0646", "\u062F\u0642\u0627\u0626\u0642", "\u062F\u0642\u064A\u0642\u0629") : "",
    ]
      .filter(Boolean)
      .join(" \u0648 "),
  join: "\u0627\u0646\u0636\u0645",
  joined: "\u0645\u0646\u0636\u0645",
  noTime: "\u0644\u0645 \u064A\u062D\u062F\u062F \u0648\u0642\u062A",
  ty: { arrival: "\u0648\u0635\u0648\u0644", return: "\u0639\u0648\u062F\u0629" },
  saving: "\u062C\u0627\u0631 \u0627\u0644\u062D\u0641\u0638...",
  saved: "\u062A\u0645 \u0627\u0644\u062D\u0641\u0638.",
  sure: "\u0647\u0644 \u0623\u0646\u062A \u0645\u062A\u0623\u0643\u062F\u061F",
  yes: "\u0646\u0639\u0645",
  cancel: "\u0625\u0644\u063A\u0627\u0621",
  ok: "\u062D\u0633\u0646\u0627",
  limitTitle: "\u062A\u0645 \u0628\u0644\u0648\u063A \u062D\u062F \u0627\u0644\u0631\u062D\u0644\u0627\u062A",
  unselect: (d, n) =>
    n
      ? `\u0625\u0644\u063A\u0627\u0621 \u0627\u062E\u062A\u064A\u0627\u0631 ${d}\u061F \u0633\u064A\u062A\u0645 \u0623\u064A\u0636\u0627 \u062D\u0630\u0641 \u0631\u062D\u0644\u0627\u062A\u0643 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645.`
      : `\u0625\u0644\u063A\u0627\u0621 \u0627\u062E\u062A\u064A\u0627\u0631 ${d}\u061F`,
  leave: (p, ty, d) => `\u0645\u063A\u0627\u062F\u0631\u0629 "${p} | ${ty}" \u064A\u0648\u0645 ${d}\u061F`,
  limitNote: (ty, d) =>
    `\u0644\u0642\u062F \u0627\u0646\u0636\u0645\u0645\u062A \u0628\u0627\u0644\u0641\u0639\u0644 \u0625\u0644\u0649 \u0631\u062D\u0644\u0629 ${ty} \u064A\u0648\u0645 ${d}. \u064A\u0633\u0645\u062D \u0628\u0631\u062D\u0644\u0629 \u0648\u0635\u0648\u0644 \u0648\u0627\u062D\u062F\u0629 \u0648\u0631\u062D\u0644\u0629 \u0639\u0648\u062F\u0629 \u0648\u0627\u062D\u062F\u0629 \u0641\u0642\u0637 \u064A\u0648\u0645\u064A\u0627. \u0644\u062A\u063A\u064A\u064A\u0631 \u0631\u062D\u0644\u062A\u0643\u060C \u063A\u0627\u062F\u0631 \u0631\u062D\u0644\u062A\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0623\u0648\u0644\u0627.`,
  changeTitle: "\u062A\u0631\u064A\u062F \u0634\u0631\u0643\u062A\u0643 \u062A\u063A\u064A\u064A\u0631 \u0628\u064A\u0627\u0646\u0627\u062A\u0643",
  changeSub:
    "\u0644\u0646 \u064A\u062A\u063A\u064A\u0631 \u0634\u064A\u0621 \u062D\u062A\u0649 \u062A\u0648\u0627\u0641\u0642. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0643\u0644 \u062A\u063A\u064A\u064A\u0631:",
  agree: "\u0645\u0648\u0627\u0641\u0642",
  decline: "\u0631\u0641\u0636",
  daysNote:
    "\u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u062A\u064A \u0644\u0645 \u062A\u0639\u062F \u0644\u062F\u064A\u0643 \u0633\u062A\u062D\u0630\u0641 \u0631\u062D\u0644\u0627\u062A\u0643 \u0641\u064A\u0647\u0627 \u0623\u064A\u0636\u0627.",
  terms: "\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0633\u064A\u0627\u0633\u0629",
  f: {
    first_name: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644",
    last_name: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0627\u0626\u0644\u0629",
    phone: "\u0627\u0644\u0647\u0627\u062A\u0641",
    parent_phone: "\u0647\u0627\u062A\u0641 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631",
    stop: "\u0646\u0642\u0637\u0629 \u0627\u0644\u0635\u0639\u0648\u062F",
    destination: "\u0627\u0644\u0648\u062C\u0647\u0629",
    days: "\u0627\u0644\u0623\u064A\u0627\u0645",
  },
  days: {
    Sunday: "\u0627\u0644\u0623\u062D\u062F",
    Monday: "\u0627\u0644\u0627\u062B\u0646\u064A\u0646",
    Tuesday: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621",
    Wednesday: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621",
    Thursday: "\u0627\u0644\u062E\u0645\u064A\u0633",
    Friday: "\u0627\u0644\u062C\u0645\u0639\u0629",
    Saturday: "\u0627\u0644\u0633\u0628\u062A",
  },
  username: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
  editProfile: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A",
  name: "\u0627\u0644\u0627\u0633\u0645",
  phoneNo: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641",
  parentPhoneNo: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631",
  save: "\u062D\u0641\u0638",
  nameReq: "\u0623\u062F\u062E\u0644 \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644 \u0648\u0627\u0633\u0645 \u0627\u0644\u0639\u0627\u0626\u0644\u0629.",
  phoneBad: "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0635\u062D\u064A\u062D\u0627.",
  parentBad:
    "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0635\u062D\u064A\u062D\u0627 \u0644\u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0623\u0648 \u0627\u062A\u0631\u0643\u0647 \u0641\u0627\u0631\u063A\u0627.",
  pickStop: "\u0627\u062E\u062A\u0631 \u0646\u0642\u0637\u0629 \u0627\u0644\u0635\u0639\u0648\u062F.",
  pickDest: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0648\u062C\u0647\u0629.",
  select: "\u0627\u062E\u062A\u0631",
  viewTerms: "\u0639\u0631\u0636 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0633\u064A\u0627\u0633\u0629",
  appearance: "\u0627\u0644\u0645\u0638\u0647\u0631",
  language: "\u0627\u0644\u0644\u063A\u0629",
  account: "\u0627\u0644\u062D\u0633\u0627\u0628",
  themes: {
    dark: "\u0643\u062D\u0644\u064A \u0648\u0633\u0645\u0627\u0648\u064A",
    gray: "\u0623\u0628\u064A\u0636 \u0648\u0631\u0645\u0627\u062F\u064A",
    slate: "\u0623\u0633\u0648\u062F \u0648\u0631\u0645\u0627\u062F\u064A",
    gold: "\u0623\u0633\u0648\u062F \u0648\u0630\u0647\u0628\u064A",
    mono: "\u0623\u0628\u064A\u0636 \u0648\u0623\u0633\u0648\u062F \u0628\u0633\u064A\u0637",
  },
};

export function useLang() {
  const [lang, setL] = useState("en");
  useEffect(() => {
    try {
      const l = localStorage.getItem(KEY);
      if (l === "ar" || l === "en") setL(l);
    } catch {}
  }, []);
  function setLang(l) {
    setL(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }
  return { lang, setLang, t: lang === "ar" ? AR : EN, dir: lang === "ar" ? "rtl" : "ltr" };
}