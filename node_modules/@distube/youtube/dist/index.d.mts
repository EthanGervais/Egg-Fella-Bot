import ytpl from '@distube/ytpl';
import ytsr from '@distube/ytsr';
import ytdl from '@distube/ytdl-core';
import { ExtractorPlugin, ResolveOptions, Song, Playlist } from 'distube';

type YouTubePluginOptions = {
    cookies?: ytdl.Cookie[];
    ytdlOptions?: ytdl.getInfoOptions;
};
declare class YouTubePlugin extends ExtractorPlugin {
    #private;
    cookies?: ytdl.Cookie[];
    constructor(options?: YouTubePluginOptions);
    get ytdlOptions(): ytdl.getInfoOptions;
    get ytCookie(): string;
    validate(url: string): boolean;
    resolve<T>(url: string, options: ResolveOptions<T>): Promise<YouTubePlaylist<T> | YouTubeSong<T>>;
    getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string>;
    getRelatedSongs(song: YouTubeSong): Promise<Song[]>;
    searchSong<T>(query: string, options: ResolveOptions<T>): Promise<Song<T> | null>;
    search(string: string, options?: {
        type?: SearchResultType.VIDEO;
        limit?: number;
        safeSearch?: boolean;
    }): Promise<YouTubeSearchResultSong[]>;
    search(string: string, options: {
        type: SearchResultType.PLAYLIST;
        limit?: number;
        safeSearch?: boolean;
    }): Promise<YouTubeSearchResultPlaylist[]>;
    search(string: string, options?: {
        type?: SearchResultType;
        limit?: number;
        safeSearch?: boolean;
    }): Promise<YouTubeSearchResultSong[] | YouTubeSearchResultPlaylist[]>;
}
declare class YouTubeSong<T = unknown> extends Song<T> {
    chapters?: ytdl.Chapter[];
    storyboards?: ytdl.storyboard[];
    related?: ytdl.relatedVideo[];
    constructor(plugin: YouTubePlugin, info: ytdl.videoInfo, options: ResolveOptions<T>);
}
declare class YouTubePlaylist<T> extends Playlist<T> {
    constructor(plugin: YouTubePlugin, info: ytpl.result, options: ResolveOptions<T>);
}
declare class YouTubeRelatedSong extends Song {
    constructor(plugin: YouTubePlugin, info: ytdl.relatedVideo);
}
declare enum SearchResultType {
    VIDEO = "video",
    PLAYLIST = "playlist"
}
declare class YouTubeSearchResultSong extends Song {
    constructor(plugin: YouTubePlugin, info: ytsr.Video);
}
declare class YouTubeSearchResultPlaylist {
    id: string;
    name: string;
    url: string;
    uploader: {
        name?: string;
        url?: string;
    };
    length: number;
    constructor(info: ytsr.Playlist);
}

export { SearchResultType, YouTubePlaylist, YouTubePlugin, type YouTubePluginOptions, YouTubeRelatedSong, YouTubeSearchResultPlaylist, YouTubeSearchResultSong, YouTubeSong };
