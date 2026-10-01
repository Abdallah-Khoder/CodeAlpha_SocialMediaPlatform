import random
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Max, Q
from django.db import transaction

from rest_framework import status, generics
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password


from .serializers import (
    RegisterSerializer,
    PostSerializer,
    CommentSerializer,
    ProfileSerializer,
    SuggestedUserSerializer,
    StoryItemSerializer,
    ConversationSerializer,
    MessageSerializer,
    NotificationSerializer,
)
from .models import (
    Post,
    PostMedia,
    Profile,
    Follow,
    Like,
    Save,
    Comment,
    Share,
    Story,
    StoryMedia,
    StoryView,
    Conversation,
    Message,
    Notification,
    EmailOTP,
    PendingSignup , 
)


import io
from PIL import Image, ImageDraw, ImageFont
from django.core.files.base import ContentFile

from django.core.mail import send_mail
from datetime import timedelta

from django.core.mail import EmailMultiAlternatives

def generate_otp_code():
    return f"{random.randint(0, 999999):06d}"



def _build_code_email(subject, code, purpose_text):
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fafafa; border-radius: 12px;">
        <h2 style="color: #1a1a1a; margin-bottom: 4px;">Vibely</h2>
        <p style="color: #555; font-size: 15px;">{purpose_text}</p>
        <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #7b2ff7;">{code}</span>
        </div>
        <p style="color: #888; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
    """
    text_content = f"Your Vibely code is: {code}\nIt expires in 10 minutes."
    return subject, text_content, html_content


def send_pending_signup_email(pending):
    subject, text_content, html_content = _build_code_email(
        "Vibely - Verify your email",
        pending.code,
        "Enter this code to verify your email and finish creating your account.",
    )
    msg = EmailMultiAlternatives(subject, text_content, None, [pending.email])
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=False)


def send_password_reset_email(otp):
    subject, text_content, html_content = _build_code_email(
        "Vibely - Reset your password",
        otp.code,
        "Enter this code to reset your password.",
    )
    msg = EmailMultiAlternatives(subject, text_content, None, [otp.user.email])
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=False)
def create_notification(
    recipient,
    actor,
    verb,
    target_post=None,
    target_conversation=None,
    target_story=None,
    target_comment=None,
):
    if recipient is None or actor is None or recipient.id == actor.id:
        return
    Notification.objects.create(
        recipient=recipient,
        actor=actor,
        verb=verb,
        target_post=target_post,
        target_conversation=target_conversation,
        target_story=target_story,
        target_comment=target_comment,
    )



class RegisterView(APIView):

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data

            PendingSignup.objects.filter(
                username=data["username"], expires_at__lt=timezone.now()
            ).delete()
            PendingSignup.objects.filter(
                email__iexact=data["email"], expires_at__lt=timezone.now()
            ).delete()

            code = generate_otp_code()

            try:
                pending = PendingSignup.objects.create(
                    username=data["username"],
                    email=data["email"],
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                    password_hash=make_password(data["password"]),
                    code=code,
                    expires_at=timezone.now() + timedelta(minutes=10),
                )
                send_pending_signup_email(pending)
            except Exception:
                return Response(
                    {"general": ["Could not send verification email. Please try again."]},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            return Response(
                {
                    "message": "Check your email for the verification code.",
                    "username": pending.username,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyEmailView(APIView):

    def post(self, request):
        username = request.data.get("username")
        code = request.data.get("code")

        if not username or not code:
            return Response(
                {"error": "Username and code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pending = PendingSignup.objects.get(username=username)
        except PendingSignup.DoesNotExist:
            return Response(
                {"error": "No pending signup found. Please sign up again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not pending.is_valid():
            pending.delete()
            return Response(
                {"error": "Code expired. Please sign up again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if pending.code != code:
            pending.attempts += 1
            pending.save()
            return Response(
                {"error": "Incorrect code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User(
            username=pending.username,
            email=pending.email,
            first_name=pending.first_name,
            last_name=pending.last_name,
            password=pending.password_hash,
        )
        user.save()

        Profile.objects.create(user=user, is_email_verified=True)

        pending.delete()

        token, created = Token.objects.get_or_create(user=user)

        return Response(
            {
                "message": "Email verified successfully.",
                "token": token.key,
                "username": user.username,
            },
            status=status.HTTP_200_OK,
        )
class ResendCodeView(APIView):

    def post(self, request):
        username = request.data.get("username")

        if not username:
            return Response(
                {"error": "Username is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pending = PendingSignup.objects.get(username=username)
        except PendingSignup.DoesNotExist:
            return Response(
                {"error": "No pending signup found. Please sign up again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() < pending.created_at + timedelta(seconds=60):
            return Response(
                {"error": "Please wait a minute before requesting a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        pending.code = generate_otp_code()
        pending.created_at = timezone.now()
        pending.expires_at = timezone.now() + timedelta(minutes=10)
        pending.attempts = 0
        pending.save()

        try:
            send_pending_signup_email(pending)
        except Exception:
            return Response(
                {"error": "Could not send verification email. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"message": "A new code has been sent."}, status=status.HTTP_200_OK)

class LoginView(APIView):

    def post(self, request):
        identifier = request.data.get("username")
        password = request.data.get("password")

        username = identifier

        if identifier and "@" in identifier:
            try:
                user_obj = User.objects.get(email__iexact=identifier)
                username = user_obj.username
            except User.DoesNotExist:
                username = None

        user = authenticate(username=username, password=password) if username else None

        if user is not None:
            if not user.profile.is_email_verified:
                return Response(
                    {
                        "error": "Email not verified. Please check your inbox for the verification code.",
                        "email_not_verified": True,
                        "username": user.username,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

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
            {"error": "Invalid username or password."},
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

            PostMedia.objects.create(
                post=post, file=file, media_type=media_type, order=index
            )

        serializer = self.get_serializer(post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        existing_like = Like.objects.filter(user=request.user, post=post).first()

        if existing_like:
            existing_like.delete()
            liked = False
        else:
            Like.objects.create(user=request.user, post=post)
            liked = True
            create_notification(
                recipient=post.user, actor=request.user, verb="like", target_post=post
            )

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
        return Comment.objects.filter(post_id=self.kwargs["post_id"]).order_by(
            "created_at"
        )

    def perform_create(self, serializer):
        post = get_object_or_404(Post, id=self.kwargs["post_id"])
        comment = serializer.save(user=self.request.user, post=post)
        create_notification(
            recipient=post.user,
            actor=self.request.user,
            verb="comment",
            target_post=post,
            target_comment=comment,
        )


class ShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        Share.objects.create(user=request.user, post=post)
        create_notification(
            recipient=post.user, actor=request.user, verb="share", target_post=post
        )
        return Response({"shares_count": post.shares.count()})

    def delete(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
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
        return Post.objects.filter(user__username=self.kwargs["username"]).order_by(
            "-created_at"
        )


class UserSharesView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Post.objects.filter(
                shares__user__username=self.kwargs["username"],
                shares__from_story=False,
                shares__from_message=False,
            )
            .distinct()
            .order_by("-shares__created_at")
        )


class MySavedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Post.objects.filter(saved_by__user=self.request.user)
            .distinct()
            .order_by("-created_at")
        )


class MyLikedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Post.objects.filter(likes__user=self.request.user)
            .distinct()
            .order_by("-created_at")
        )


class MyCommentedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Post.objects.filter(comments__user=self.request.user)
            .distinct()
            .order_by("-created_at")
        )


class MySharedPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Post.objects.filter(
                shares__user=self.request.user,
                shares__from_story=False,
                shares__from_message=False,
            )
            .distinct()
            .order_by("-created_at")
        )


SUGGESTION_LIMIT = 5


class FollowToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        target_user = get_object_or_404(User, username=username)

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
            create_notification(
                recipient=target_user, actor=request.user, verb="follow"
            )

        return Response({"following": following})


class SuggestedUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        following_ids = list(
            Follow.objects.filter(follower=request.user).values_list(
                "following_id", flat=True
            )
        )
        excluded_ids = following_ids + [request.user.id]

        mutual_candidates = list(
            User.objects.filter(followers__follower_id__in=following_ids)
            .exclude(id__in=excluded_ids)
            .distinct()
        )

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

        serializer = SuggestedUserSerializer(
            suggestions, many=True, context={"request": request}
        )
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

        return Response(
            {"profile_picture": request.build_absolute_uri(profile.profile_picture.url)}
        )


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

        active_stories = (
            Story.objects.filter(user_id__in=user_ids, expires_at__gt=now)
            .select_related("user", "user__profile")
            .order_by("created_at")
        )

        grouped = {}
        order = []

        for story in active_stories:
            uid = story.user_id
            if uid not in grouped:
                profile_picture = None
                profile = getattr(story.user, "profile", None)
                if profile and profile.profile_picture:
                    profile_picture = request.build_absolute_uri(
                        profile.profile_picture.url
                    )

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

        media_id = request.data.get("media_id")
        if media_id:
            selected_media = post.media.filter(id=media_id).first()
        else:
            selected_media = post.media.first()

        story = Story.objects.create(user=request.user, related_post=post)

        Share.objects.create(user=request.user, post=post, from_story=True)
        create_notification(
            recipient=post.user,
            actor=request.user,
            verb="story_share",
            target_post=post,
            target_story=story,
        )

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
        width, height = 1080, 1920
        background_color = (108, 60, 233)

        image = Image.new("RGB", (width, height), color=background_color)
        draw = ImageDraw.Draw(image)

        try:
            font = ImageFont.truetype("arial.ttf", 60)
        except IOError:
            font = ImageFont.load_default()

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


class ConversationsUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = (
            Message.objects.filter(
                conversation__participants=request.user, is_read=False
            )
            .exclude(sender=request.user)
            .count()
        )
        return Response({"unread_count": count})


class ConversationStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        username = request.data.get("username")
        target_user = get_object_or_404(User, username=username)

        if target_user == request.user:
            return Response(
                {"error": "You cannot message yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            Conversation,
            id=self.kwargs["conversation_id"],
            participants=self.request.user,
        )
        conversation.messages.filter(is_read=False).exclude(
            sender=self.request.user
        ).update(is_read=True)
        return conversation.messages.all()

    def create(self, request, *args, **kwargs):
        conversation = get_object_or_404(
            Conversation, id=self.kwargs["conversation_id"], participants=request.user
        )

        text = request.data.get("text", "").strip()
        image = request.FILES.get("image")
        shared_post_id = request.data.get("shared_post_id")
        shared_post = (
            Post.objects.filter(id=shared_post_id).first() if shared_post_id else None
        )

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

        if shared_post:
            Share.objects.create(user=request.user, post=shared_post, from_message=True)
            create_notification(
                recipient=shared_post.user,
                actor=request.user,
                verb="friend_share",
                target_post=shared_post,
            )

        other_participants = conversation.participants.exclude(id=request.user.id)
        for participant in other_participants:
            create_notification(
                recipient=participant,
                actor=request.user,
                verb="message",
                target_conversation=conversation,
            )

        serializer = self.get_serializer(message)
        response_data = serializer.data
        if shared_post:
            response_data["shares_count"] = shared_post.shares.count()

        return Response(response_data, status=status.HTTP_201_CREATED)


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

        message.is_deleted = True
        message.save()

        serializer = MessageSerializer(message, context={"request": request})
        return Response(serializer.data)


class UserSearchView(generics.ListAPIView):
    serializer_class = SuggestedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get("q", "").strip()
        if not query:
            return User.objects.none()

        return (
            User.objects.filter(
                Q(username__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
            .exclude(id=self.request.user.id)
            .distinct()[:30]
        )


class PostSearchView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PostPagination

    def get_queryset(self):
        query = self.request.query_params.get("q", "").strip()
        if not query:
            return Post.objects.none()

        return Post.objects.filter(content__icontains=query).order_by("-created_at")


class NotificationPagination(PageNumberPagination):
    page_size = 30


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        # No longer marks everything as read here -> each notification is
        # marked read individually, only when the user clicks it
        return Notification.objects.filter(recipient=self.request.user)


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"unread_count": count})


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notification = get_object_or_404(Notification, id=pk, recipient=request.user)
        notification.is_read = True
        notification.save()
        return Response({"is_read": True})


class StoryDetailGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, story_id):
        story = get_object_or_404(Story, id=story_id)

        if not story.is_active():
            return Response(
                {"error": "This story has expired."}, status=status.HTTP_404_NOT_FOUND
            )

        story_user = story.user
        active_stories = Story.objects.filter(
            user=story_user, expires_at__gt=timezone.now()
        ).order_by("created_at")

        profile_picture = None
        profile = getattr(story_user, "profile", None)
        if profile and profile.profile_picture:
            profile_picture = request.build_absolute_uri(profile.profile_picture.url)

        stories_data = [
            StoryItemSerializer(s, context={"request": request}).data
            for s in active_stories
        ]

        return Response(
            {
                "username": story_user.username,
                "profile_picture": profile_picture,
                "stories": stories_data,
            }
        )


class UserStoryGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        target_user = get_object_or_404(User, username=username)
        active_stories = Story.objects.filter(
            user=target_user, expires_at__gt=timezone.now()
        ).order_by("created_at")

        if not active_stories.exists():
            return Response({"has_story": False})

        stories_data = [
            StoryItemSerializer(s, context={"request": request}).data
            for s in active_stories
        ]
        has_unviewed = any(not s["is_viewed"] for s in stories_data)

        return Response(
            {
                "has_story": True,
                "has_unviewed": has_unviewed,
                "username": target_user.username,
                "profile_picture": None,  # not needed here, Profile page already has it
                "stories": stories_data,
            }
        )


class ReelsListView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PostPagination

    def get_queryset(self):
        # Random order instead of chronological, so the reels feed doesn't
        # feel like a repetitive list
        return Post.objects.filter(media__media_type="video").distinct().order_by("?")

class ForgotPasswordView(APIView):

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response(
                {"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"error": "No account found with this email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        last_otp = EmailOTP.objects.filter(user=user).order_by("-created_at").first()
        if last_otp and timezone.now() < last_otp.created_at + timedelta(seconds=60):
            return Response(
                {"error": "Please wait a minute before requesting a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = generate_otp_code()
        otp = EmailOTP.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        try:
            send_password_reset_email(otp)
        except Exception:
            return Response(
                {"error": "Could not send reset email. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"message": "A reset code has been sent to your email."},
            status=status.HTTP_200_OK,
        )

class ResetPasswordView(APIView):

    def post(self, request):
        email = request.data.get("email")
        code = request.data.get("code")
        new_password = request.data.get("new_password")

        if not email or not code or not new_password:
            return Response(
                {"error": "Email, code, and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid email or code."}, status=status.HTTP_400_BAD_REQUEST
            )

        otp = (
            EmailOTP.objects.filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )

        if otp is None or not otp.is_valid():
            return Response(
                {"error": "Code expired or invalid. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.code != code:
            otp.attempts += 1
            otp.save()
            return Response(
                {"error": "Incorrect code."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_password(new_password, user=user)
        except Exception as e:
            return Response({"new_password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save()

        user.password = make_password(new_password)
        user.save()

        return Response(
            {"message": "Password reset successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )
