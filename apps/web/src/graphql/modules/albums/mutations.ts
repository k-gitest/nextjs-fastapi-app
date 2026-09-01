export const CREATE_ALBUM = /* GraphQL */ `
  mutation CreateAlbum($input: AlbumCreateInput!) {
    createAlbum(input: $input) {
      __typename
      ... on CreateAlbumPayload {
        album {
          id
          name
        }
      }
      ... on ValidationError {
        message
      }
      ... on ConflictError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;

export const UPDATE_ALBUM = /* GraphQL */ `
  mutation UpdateAlbum($id: ID!, $input: AlbumUpdateInput!) {
    updateAlbum(id: $id, input: $input) {
      __typename
      ... on UpdateAlbumPayload {
        album {
          id
          name
        }
      }
      ... on ValidationError {
        message
      }
      ... on ConflictError {
        message
      }
      ... on NotFoundError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;

export const DELETE_ALBUM = /* GraphQL */ `
  mutation DeleteAlbum($id: ID!, $correlationId: String!) {
    deleteAlbum(id: $id, correlationId: $correlationId) {
      __typename
      ... on DeleteAlbumPayload {
        album {
          id
          name
        }
        deletedId
        message
      }
      ... on NotFoundError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;