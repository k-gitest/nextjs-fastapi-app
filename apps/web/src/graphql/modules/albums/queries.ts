export const GET_ALBUMS = /* GraphQL */ `
  query GetAlbums {
    albums {
      id
      name
      userId
      displayOrder
      createdAt
      updatedAt
    }
  }
`;

export const GET_ALBUM_DETAIL = /* GraphQL */ `
  query GetAlbumDetail($id: ID!) {
    album(id: $id) {
      id
      name
      userId
      displayOrder
      createdAt
      updatedAt
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