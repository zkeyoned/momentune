package main

import (
	"github.com/guohuiyuan/music-lib/model"
	"github.com/guohuiyuan/music-lib/netease"
)

type NeteaseCrawler struct{}

func (c *NeteaseCrawler) SearchPlaylists(keyword string) ([]model.Playlist, error) {
	return netease.SearchPlaylist(keyword)
}

func (c *NeteaseCrawler) GetSongs(playlistID string) ([]model.Song, error) {
	return netease.GetPlaylistSongs(playlistID)
}
