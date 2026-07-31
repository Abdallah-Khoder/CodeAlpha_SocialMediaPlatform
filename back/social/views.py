from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404

from rest_framework import status , generics
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination


from .serializers import RegisterSerializer , PostSerializer , CommentSerializer , ProfileSerializer
from .models import Post, PostMedia, Profile ,Follow , Like, Save, Comment, Share

class RegisterView(APIView):

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()

            token, created = Token.objects.get_or_create(user=user)

            return Response(
                {
                    "message": "Account created successfully",
                    "token": token.key,
                    "username": user.username,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if user is not None:
            token, created = Token.objects.get_or_create(user=user)

            return Response(
                {
                    "message": "Login successful",
                    "token": token.key,
                    "username": user.username,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {"error": "Invalid username or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class CurrentUserView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()

        return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)


class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # IDs of users that the current user follows
        following_ids = Follow.objects.filter(
            follower=self.request.user
        ).values_list("following_id", flat=True)

        # Show posts from the user themselves + users they follow
        return Post.objects.filter(
            user_id__in=list(following_ids) + [self.request.user.id]
        ).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        content = request.data.get("content", "").strip()
        files = request.FILES.getlist("media")

        # A post must have at least text or at least one media file
        if not content and not files:
            return Response(
                {"error": "A post must contain text or at least one media file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post = Post.objects.create(user=request.user, content=content)

        for index, file in enumerate(files):
            # Determine media type from the file's content_type
            if file.content_type.startswith("image/"):
                media_type = "image"
            elif file.content_type.startswith("video/"):
                media_type = "video"
            else:
                # Skip unsupported file types silently
                continue

            PostMedia.objects.create(
                post=post,
                file=file,
                media_type=media_type,
                order=index,
            )

        serializer = self.get_serializer(post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        existing_like = Like.objects.filter(user=request.user, post=post).first()

        if existing_like:
            # Already liked -> remove it (unlike)
            existing_like.delete()
            liked = False
        else:
            # Not liked yet -> create it
            Like.objects.create(user=request.user, post=post)
            liked = True

        return Response({"liked": liked, "likes_count": post.likes.count()})


class SaveToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        existing_save = Save.objects.filter(user=request.user, post=post).first()

        if existing_save:
            existing_save.delete()
            saved = False
        else:
            Save.objects.create(user=request.user, post=post)
            saved = True

        return Response({"saved": saved})


class CommentPagination(PageNumberPagination):
    page_size = 15


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CommentPagination

    def get_queryset(self):
        return Comment.objects.filter(
            post_id=self.kwargs["post_id"]
        ).order_by("created_at")

    def perform_create(self, serializer):
        post = get_object_or_404(Post, id=self.kwargs["post_id"])
        serializer.save(user=self.request.user, post=post)


class ShareCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        # A share can happen more than once, unlike a like/save
        Share.objects.create(user=request.user, post=post)
        return Response({"shares_count": post.shares.count()})


class UserProfileView(generics.RetrieveAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    queryset = Profile.objects.all()
    lookup_field = "user__username"
    lookup_url_kwarg = "username"


class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(
            user__username=self.kwargs["username"]
        ).order_by("-created_at")


class UserSharesView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(
            shares__user__username=self.kwargs["username"]
        ).distinct().order_by("-shares__created_at")

class MySavedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(
            saved_by__user=self.request.user
        ).distinct().order_by("-created_at")


class MyLikedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(
            likes__user=self.request.user
        ).distinct().order_by("-created_at")


class MyCommentedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(
            comments__user=self.request.user
        ).distinct().order_by("-created_at")


class MySharedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Post.objects.filter(
            shares__user=self.request.user
        ).distinct().order_by("-created_at")