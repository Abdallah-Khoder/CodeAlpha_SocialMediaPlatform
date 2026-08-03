import random
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status , generics
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination


from .serializers import RegisterSerializer , PostSerializer , CommentSerializer , ProfileSerializer , SuggestedUserSerializer , StoryItemSerializer
from .models import Post, PostMedia, Profile ,Follow , Like, Save, Comment, Share , Story, StoryMedia, StoryView

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
        profile = getattr(request.user, "profile", None)
        profile_picture = None
        if profile and profile.profile_picture:
            profile_picture = request.build_absolute_uri(profile.profile_picture.url)

        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "first_name": request.user.first_name,
                "last_name": request.user.last_name,
                "profile_picture": profile_picture,
            },
            status=status.HTTP_200_OK,
        )
    
class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()

        return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)


class PostPagination(PageNumberPagination):
    page_size = 20


class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PostPagination

    def get_queryset(self):
        # Now returns ALL posts from everyone, not just followed users
        return Post.objects.all().order_by("-created_at")

    def create(self, request, *args, **kwargs):
        content = request.data.get("content", "").strip()
        files = request.FILES.getlist("media")

        if not content and not files:
            return Response(
                {"error": "A post must contain text or at least one media file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post = Post.objects.create(user=request.user, content=content)

        for index, file in enumerate(files):
            if file.content_type.startswith("image/"):
                media_type = "image"
            elif file.content_type.startswith("video/"):
                media_type = "video"
            else:
                continue

            PostMedia.objects.create(post=post, file=file, media_type=media_type, order=index)

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


class ShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        Share.objects.create(user=request.user, post=post)
        return Response({"shares_count": post.shares.count()})

    def delete(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        # Removes this user's share(s) of this post ("unshare")
        Share.objects.filter(user=request.user, post=post).delete()
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


SUGGESTION_LIMIT = 5


class FollowToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        target_user = get_object_or_404(User, username=username)

        # Prevent following yourself
        if target_user == request.user:
            return Response(
                {"error": "You cannot follow yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_follow = Follow.objects.filter(
            follower=request.user, following=target_user
        ).first()

        if existing_follow:
            existing_follow.delete()
            following = False
        else:
            Follow.objects.create(follower=request.user, following=target_user)
            following = True

        return Response({"following": following})


class SuggestedUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # IDs of users the current user already follows
        following_ids = list(
            Follow.objects.filter(follower=request.user).values_list(
                "following_id", flat=True
            )
        )
        excluded_ids = following_ids + [request.user.id]

        # Priority 1: users followed by people I follow (mutual connections)
        mutual_candidates = list(
            User.objects.filter(followers__follower_id__in=following_ids)
            .exclude(id__in=excluded_ids)
            .distinct()
        )

        # Priority 2: fill the rest randomly with any other user
        remaining_slots = SUGGESTION_LIMIT - len(mutual_candidates)
        random_candidates = []
        if remaining_slots > 0:
            mutual_ids = [u.id for u in mutual_candidates]
            random_candidates = list(
                User.objects.exclude(id__in=excluded_ids + mutual_ids).order_by("?")[
                    :remaining_slots
                ]
            )

        suggestions = (mutual_candidates + random_candidates)[:SUGGESTION_LIMIT]

        serializer = SuggestedUserSerializer(suggestions, many=True, context={"request": request})
        return Response(serializer.data)

class ProfilePictureUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        profile = request.user.profile
        file = request.FILES.get("profile_picture")

        if not file:
            return Response(
                {"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        profile.profile_picture = file
        profile.save()

        return Response({
            "profile_picture": request.build_absolute_uri(profile.profile_picture.url)
        })

class FollowersListView(generics.ListAPIView):
    serializer_class = SuggestedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        target_user = get_object_or_404(User, username=self.kwargs["username"])
        follower_ids = Follow.objects.filter(following=target_user).values_list(
            "follower_id", flat=True
        )
        return User.objects.filter(id__in=follower_ids)


class FollowingListView(generics.ListAPIView):
    serializer_class = SuggestedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        target_user = get_object_or_404(User, username=self.kwargs["username"])
        following_ids = Follow.objects.filter(follower=target_user).values_list(
            "following_id", flat=True
        )
        return User.objects.filter(id__in=following_ids)

class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]
    queryset = Post.objects.all()

    def update(self, request, *args, **kwargs):
        post = self.get_object()

        if post.user != request.user:
            return Response(
                {"error": "You can only edit your own posts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        content = request.data.get("content")
        if content is not None:
            post.content = content.strip()
            post.save()

        serializer = self.get_serializer(post)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()

        if post.user != request.user:
            return Response(
                {"error": "You can only delete your own posts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)




class StoriesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        following_ids = Follow.objects.filter(follower=request.user).values_list(
            "following_id", flat=True
        )
        user_ids = list(following_ids) + [request.user.id]

        # Only stories that haven't expired yet
        active_stories = Story.objects.filter(
            user_id__in=user_ids, expires_at__gt=now
        ).select_related("user", "user__profile").order_by("created_at")

        grouped = {}
        order = []

        for story in active_stories:
            uid = story.user_id
            if uid not in grouped:
                profile_picture = None
                profile = getattr(story.user, "profile", None)
                if profile and profile.profile_picture:
                    profile_picture = request.build_absolute_uri(profile.profile_picture.url)

                grouped[uid] = {
                    "username": story.user.username,
                    "profile_picture": profile_picture,
                    "stories": [],
                }
                order.append(uid)

            serialized = StoryItemSerializer(story, context={"request": request}).data
            grouped[uid]["stories"].append(serialized)

        result = []
        for uid in order:
            entry = grouped[uid]
            entry["has_unviewed"] = any(not s["is_viewed"] for s in entry["stories"])
            result.append(entry)

        # Show your own story group first, if you have one
        result.sort(key=lambda e: 0 if e["username"] == request.user.username else 1)

        return Response(result)

    def post(self, request):
        file = request.FILES.get("media")

        if not file:
            return Response(
                {"error": "A story requires an image or video."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.content_type.startswith("image/"):
            media_type = "image"
        elif file.content_type.startswith("video/"):
            media_type = "video"
        else:
            return Response(
                {"error": "Unsupported file type."}, status=status.HTTP_400_BAD_REQUEST
            )

        story = Story.objects.create(user=request.user)
        StoryMedia.objects.create(story=story, file=file, media_type=media_type)

        serializer = StoryItemSerializer(story, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class StoryViewMarkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, story_id):
        story = get_object_or_404(Story, id=story_id)
        StoryView.objects.get_or_create(user=request.user, story=story)
        return Response({"marked": True})


class StoryViewersView(generics.ListAPIView):
    serializer_class = SuggestedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        story = get_object_or_404(Story, id=self.kwargs["story_id"])

        # Only the story's owner can see who viewed it
        if story.user_id != self.request.user.id:
            return User.objects.none()

        viewer_ids = list(
            StoryView.objects.filter(story=story)
            .order_by("-viewed_at")
            .values_list("user_id", flat=True)
        )

        # Preserve the "most recent view first" ordering
        users = list(User.objects.filter(id__in=viewer_ids))
        users.sort(key=lambda u: viewer_ids.index(u.id))
        return users