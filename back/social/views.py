import random
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Max

from rest_framework import status , generics
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination


from .serializers import RegisterSerializer , PostSerializer , CommentSerializer , ProfileSerializer , SuggestedUserSerializer , StoryItemSerializer , ConversationSerializer, MessageSerializer
from .models import Post, PostMedia, Profile ,Follow , Like, Save, Comment, Share , Story, StoryMedia, StoryView , Conversation, Message 


import io
from PIL import Image, ImageDraw, ImageFont
from django.core.files.base import ContentFile





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
            shares__user__username=self.kwargs["username"],
            shares__from_story=False
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
            shares__user=self.request.user , 
            shares__from_story=False,
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

        if story.user_id != self.request.user.id:
            return User.objects.none()

        viewer_ids = list(
            StoryView.objects.filter(story=story)
            .order_by("-viewed_at")
            .values_list("user_id", flat=True)
        )

        users = list(User.objects.filter(id__in=viewer_ids))
        users.sort(key=lambda u: viewer_ids.index(u.id))
        return users


class ShareToStoryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)

        # Use the specific media item the user was viewing (if provided),
        # otherwise fall back to the first media item on the post
        media_id = request.data.get("media_id")
        if media_id:
            selected_media = post.media.filter(id=media_id).first()
        else:
            selected_media = post.media.first()

        story = Story.objects.create(user=request.user, related_post=post)

        # Sharing to your story also counts toward the share number,
        # but is flagged so it doesn't show up in the "Shares" list/tab
        Share.objects.create(user=request.user, post=post, from_story=True)

        if selected_media:
            selected_media.file.open("rb")
            file_content = selected_media.file.read()
            selected_media.file.close()

            file_name = selected_media.file.name.split("/")[-1]
            story_media = StoryMedia(story=story, media_type=selected_media.media_type)
            story_media.file.save(file_name, ContentFile(file_content), save=True)
        else:
            image = self._generate_text_card(post.content)
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")

            story_media = StoryMedia(story=story, media_type="image")
            story_media.file.save(
                f"story_{story.id}.png", ContentFile(buffer.getvalue()), save=True
            )

        serializer = StoryItemSerializer(story, context={"request": request})
        response_data = serializer.data
        response_data["shares_count"] = post.shares.count()
        return Response(response_data, status=status.HTTP_201_CREATED)

    def _generate_text_card(self, text):
        # Vibely-purple background with the post's text centered on it
        width, height = 1080, 1920
        background_color = (108, 60, 233)  # matches Vibely's #6c3ce9 accent

        image = Image.new("RGB", (width, height), color=background_color)
        draw = ImageDraw.Draw(image)

        try:
            font = ImageFont.truetype("arial.ttf", 60)
        except IOError:
            font = ImageFont.load_default()

        # Simple word-wrap so long posts don't overflow the card
        max_chars_per_line = 22
        words = (text or "").split()
        lines = []
        current_line = ""
        for word in words:
            test_line = f"{current_line} {word}".strip()
            if len(test_line) <= max_chars_per_line:
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)

        line_height = 80
        total_text_height = len(lines) * line_height
        start_y = (height - total_text_height) // 2

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2
            y = start_y + i * line_height
            draw.text((x, y), line, font=font, fill=(255, 255, 255))

        return image


class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Conversation.objects.filter(participants=self.request.user)
            .annotate(last_message_at=Max("messages__created_at"))
            .order_by("-last_message_at")
        )


class ConversationStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        username = request.data.get("username")
        target_user = get_object_or_404(User, username=username)

        if target_user == request.user:
            return Response(
                {"error": "You cannot message yourself."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Look for an existing 1-on-1 conversation between these two users
        candidates = Conversation.objects.filter(participants=request.user).filter(
            participants=target_user
        )
        conversation = None
        for c in candidates:
            if c.participants.count() == 2:
                conversation = c
                break

        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.add(request.user, target_user)

        return Response({"conversation_id": conversation.id})


class MessagePagination(PageNumberPagination):
    page_size = 30


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = MessagePagination

    def get_queryset(self):
        conversation = get_object_or_404(
            Conversation, id=self.kwargs["conversation_id"], participants=self.request.user
        )
        # Mark any messages from the other person as read now that we're opening this
        conversation.messages.filter(is_read=False).exclude(sender=self.request.user).update(
            is_read=True
        )
        return conversation.messages.all()

    def create(self, request, *args, **kwargs):
        conversation = get_object_or_404(
            Conversation, id=self.kwargs["conversation_id"], participants=request.user
        )

        text = request.data.get("text", "").strip()
        image = request.FILES.get("image")
        shared_post_id = request.data.get("shared_post_id")
        shared_post = Post.objects.filter(id=shared_post_id).first() if shared_post_id else None

        if not text and not image and not shared_post:
            return Response(
                {"error": "A message needs text, an image, or a shared post."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            text=text,
            image=image,
            shared_post=shared_post,
        )

        serializer = self.get_serializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_owned_message(self, pk, user):
        message = get_object_or_404(Message, id=pk)
        if message.sender != user:
            return None
        return message

    def patch(self, request, pk):
        message = self.get_owned_message(pk, request.user)
        if message is None:
            return Response(
                {"error": "You can only edit your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if message.is_deleted:
            return Response(
                {"error": "You can't edit a deleted message."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Editing is only supported for plain text messages
        if message.image or message.shared_post_id:
            return Response(
                {"error": "Only text messages can be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        text = request.data.get("text", "").strip()
        if not text:
            return Response(
                {"error": "Message text cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message.text = text
        message.is_edited = True
        message.save()

        serializer = MessageSerializer(message, context={"request": request})
        return Response(serializer.data)

    def delete(self, request, pk):
        message = self.get_owned_message(pk, request.user)
        if message is None:
            return Response(
                {"error": "You can only delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Soft delete: keep the row, hide the content, flag it
        message.is_deleted = True
        message.save()

        serializer = MessageSerializer(message, context={"request": request})
        return Response(serializer.data)