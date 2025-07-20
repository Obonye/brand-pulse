import { Controller, Post, Body, HttpStatus, Get, UseGuards, Request, Response } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from '../modules/auth/dto/register.dto';
import { LoginDto } from '../modules/auth/dto/login.dto';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';

@ApiTags('Authentication')  // Groups these endpoints in Swagger docs
@Controller('auth')         // All routes start with /api/auth
export class AuthController {
  
  constructor(private authService: AuthService) {}  // Get the AuthService

  @Post('register')  // POST /api/auth/register
  @ApiOperation({ summary: 'Register new tenant and admin user' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Registration successful' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Registration failed' 
  })
  async register(@Body() registerDto: RegisterDto) {
    // @Body() tells NestJS: "Get data from request body and validate it against RegisterDto"
    // The validation happens automatically because of class-validator decorators
    
    return this.authService.register(registerDto);
  }

  @Post('login')  // POST /api/auth/login
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Login successful' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid credentials' 
  })
  async login(@Body() loginDto: LoginDto, @Response() res: ExpressResponse) {
    const result = await this.authService.login(loginDto);
    
    // Set httpOnly cookie with the access token
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return user data without the token
    const { access_token, ...userResponse } = result;
    return res.json(userResponse);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Logout successful' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid token' 
  })
  async logout(@Request() req: any, @Response() res: ExpressResponse) {
    const result = await this.authService.logout(req.user);
    
    // Clear the httpOnly cookie
    res.clearCookie('access_token');
    
    return res.json(result);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session information' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Session information retrieved' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid token' 
  })
  async getSession(@Request() req: any) {
    return this.authService.getSession(req.user);
  }
}