export const GET_ALBUMS = /* GraphQL */ `
  query GetAlbums {
    albums {
      id
      name
    }
  }
`;

export const GET_ALBUM_DETAIL = /* GraphQL */ `
  query GetAlbumDetail($id: ID!) {
    album(id: $id) {
      id
      name
      images {
        id
        originalFileName
        mimeType
        fileSize
        createdAt
        usageCount
      }
    }
  }
`;