var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import ytpl from "@distube/ytpl";
import ytsr from "@distube/ytsr";
import ytdl from "@distube/ytdl-core";

// src/util.ts
var clone = /* @__PURE__ */ __name((obj) => {
  const result = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    result[key] = typeof obj[key] === "object" ? clone(obj[key]) : obj[key];
  }
  return result;
}, "clone");
function toSecond(input) {
  if (!input) return 0;
  if (typeof input !== "string") return Number(input) || 0;
  if (input.includes(":")) {
    const time = input.split(":").reverse();
    let seconds = 0;
    for (let i = 0; i < 3; i++) if (time[i]) seconds += Number(time[i].replace(/[^\d.]+/g, "")) * Math.pow(60, i);
    if (time.length > 3) seconds += Number(time[3].replace(/[^\d.]+/g, "")) * 24 * 60 * 60;
    return seconds;
  } else {
    return Number(input.replace(/[^\d.]+/g, "")) || 0;
  }
}
__name(toSecond, "toSecond");
function parseNumber(input) {
  if (typeof input === "string") return Number(input.replace(/[^\d.]+/g, "")) || 0;
  return Number(input) || 0;
}
__name(parseNumber, "parseNumber");

// src/index.ts
import { DisTubeError, ExtractorPlugin, Playlist, Song, checkInvalidKey } from "distube";
var YouTubePlugin = class extends ExtractorPlugin {
  static {
    __name(this, "YouTubePlugin");
  }
  #cookies;
  cookies;
  #ytdlOptions;
  constructor(options = {}) {
    super();
    checkInvalidKey(options, ["cookies", "ytdlOptions"], "YouTubePlugin");
    this.cookies = this.#cookies = options.cookies ? clone(options.cookies) : void 0;
    this.#ytdlOptions = options?.ytdlOptions ? clone(options.ytdlOptions) : {};
    this.#ytdlOptions.agent = ytdl.createAgent(this.cookies);
  }
  get ytdlOptions() {
    if (this.cookies !== this.#cookies) this.#ytdlOptions.agent = ytdl.createAgent(this.#cookies = this.cookies);
    return this.#ytdlOptions;
  }
  get ytCookie() {
    const agent = this.#ytdlOptions.agent;
    if (!agent) return "";
    const { jar } = agent;
    return jar.getCookieStringSync("https://www.youtube.com");
  }
  validate(url) {
    if (ytdl.validateURL(url) || ytpl.validateID(url)) return true;
    return false;
  }
  async resolve(url, options) {
    if (ytpl.validateID(url)) {
      const info = await ytpl(url, { limit: Infinity, requestOptions: { headers: { cookie: this.ytCookie } } });
      return new YouTubePlaylist(this, info, options);
    }
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getBasicInfo(url, this.ytdlOptions);
      return new YouTubeSong(this, info, options);
    }
    throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
  }
  async getStreamURL(song) {
    if (!song.url || !ytdl.validateURL(song.url)) throw new DisTubeError("CANNOT_RESOLVE_SONG", song);
    const info = await ytdl.getInfo(song.url, this.ytdlOptions);
    if (!info.formats?.length) throw new DisTubeError("UNAVAILABLE_VIDEO");
    const newSong = new YouTubeSong(this, info, {});
    song.ageRestricted = newSong.ageRestricted;
    song.views = newSong.views;
    song.likes = newSong.likes;
    song.thumbnail = newSong.thumbnail;
    song.related = newSong.related;
    song.chapters = newSong.chapters;
    song.storyboards = newSong.storyboards;
    const format = info.formats.filter((f) => f.hasAudio && (!newSong.isLive || f.isHLS)).sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate))[0];
    if (!format) throw new DisTubeError("UNPLAYABLE_FORMATS");
    return format.url;
  }
  async getRelatedSongs(song) {
    return (song.related ? song.related : (await ytdl.getBasicInfo(song.url, this.ytdlOptions)).related_videos).filter((r) => r.id).map((r) => new YouTubeRelatedSong(this, r));
  }
  async searchSong(query, options) {
    const result = await this.search(query, { type: "video" /* VIDEO */, limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.name,
        url: info.url,
        thumbnail: info.thumbnail,
        duration: info.duration,
        views: info.views,
        uploader: info.uploader
      },
      options
    );
  }
  /**
   * Search for a song.
   *
   * @param query              - The string search for
   * @param options            - Search options
   * @param options.limit      - Limit the results
   * @param options.type       - Type of results (`video` or `playlist`).
   * @param options.safeSearch - Whether or not use safe search (YouTube restricted mode)
   *
   * @returns Array of results
   */
  async search(query, options = {}) {
    const { items } = await ytsr(query, {
      type: "video" /* VIDEO */,
      limit: 10,
      safeSearch: false,
      ...options,
      requestOptions: { headers: { cookie: this.ytCookie } }
    });
    return items.map((i) => {
      if (i.type === "video") return new YouTubeSearchResultSong(this, i);
      return new YouTubeSearchResultPlaylist(i);
    });
  }
};
var YouTubeSong = class extends Song {
  static {
    __name(this, "YouTubeSong");
  }
  chapters;
  storyboards;
  related;
  constructor(plugin, info, options) {
    const i = info.videoDetails;
    super(
      {
        plugin,
        source: "youtube",
        playFromSource: true,
        id: i.videoId,
        name: i.title,
        isLive: Boolean(i.isLive),
        duration: i.isLive ? 0 : toSecond(i.lengthSeconds),
        url: i.video_url || `https://youtu.be/${i.videoId}`,
        thumbnail: i.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
        views: parseNumber(i.viewCount || i.view_count || i.views),
        likes: parseNumber(i.likes),
        uploader: {
          name: i.author?.name || i.author?.user,
          url: i.author?.channel_url || i.author?.external_channel_url || i.author?.user_url || i.author?.id ? `https://www.youtube.com/channel/${i.author.id}` : i.author?.user ? `https://www.youtube.com/${i.author.user}` : void 0
        },
        ageRestricted: Boolean(i.age_restricted)
      },
      options
    );
    this.chapters = i.chapters || [];
    this.storyboards = i.storyboards || [];
    this.related = info.related_videos || [];
  }
};
var YouTubePlaylist = class extends Playlist {
  static {
    __name(this, "YouTubePlaylist");
  }
  constructor(plugin, info, options) {
    const songs = info.items.map(
      (i) => new Song({
        plugin,
        playFromSource: true,
        source: "youtube",
        id: i.id,
        name: i.title,
        url: i.url,
        thumbnail: i.thumbnail,
        duration: toSecond(i.duration),
        isLive: Boolean(i.isLive),
        uploader: {
          name: i.author?.name,
          url: i.author?.url || i.author?.channelID ? `https://www.youtube.com/channel/${i.author.channelID}` : void 0
        }
      })
    );
    super(
      {
        source: "youtube",
        id: info.id,
        name: info.title,
        url: info.url,
        thumbnail: info.thumbnail?.url,
        songs
      },
      options
    );
  }
};
var YouTubeRelatedSong = class extends Song {
  static {
    __name(this, "YouTubeRelatedSong");
  }
  constructor(plugin, info) {
    if (!info.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", info);
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
      isLive: Boolean(info.isLive),
      duration: info.isLive ? 0 : toSecond(info.length_seconds),
      views: parseNumber(info.view_count),
      uploader: typeof info.author === "string" ? {
        name: info.author
      } : {
        name: info.author?.name || info.author?.user,
        url: info.author?.channel_url || info.author?.external_channel_url || info.author?.user_url || info.author?.id ? `https://www.youtube.com/channel/${info.author.id}` : info.author?.user ? `https://www.youtube.com/${info.author.user}` : void 0
      }
    });
  }
};
var SearchResultType = /* @__PURE__ */ ((SearchResultType2) => {
  SearchResultType2["VIDEO"] = "video";
  SearchResultType2["PLAYLIST"] = "playlist";
  return SearchResultType2;
})(SearchResultType || {});
var YouTubeSearchResultSong = class extends Song {
  static {
    __name(this, "YouTubeSearchResultSong");
  }
  constructor(plugin, info) {
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.name,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnail,
      isLive: info.isLive,
      duration: toSecond(info.duration),
      views: parseNumber(info.views),
      uploader: {
        name: info.author?.name,
        url: info.author?.url
      }
    });
  }
};
var YouTubeSearchResultPlaylist = class {
  static {
    __name(this, "YouTubeSearchResultPlaylist");
  }
  /**
   * YouTube  playlist id
   */
  id;
  /**
   * Playlist title.
   */
  name;
  /**
   * Playlist URL.
   */
  url;
  /**
   * Playlist owner
   */
  uploader;
  /**
   * Number of videos in the playlist
   */
  length;
  constructor(info) {
    this.id = info.id;
    this.name = info.name;
    this.url = `https://www.youtube.com/playlist?list=${info.id}`;
    this.uploader = {
      name: info.owner?.name,
      url: info.owner?.url
    };
    this.length = info.length;
    this.uploader = {
      name: info.owner?.name,
      url: info.owner?.url
    };
  }
};
export {
  SearchResultType,
  YouTubePlaylist,
  YouTubePlugin,
  YouTubeRelatedSong,
  YouTubeSearchResultPlaylist,
  YouTubeSearchResultSong,
  YouTubeSong
};
//# sourceMappingURL=index.mjs.map